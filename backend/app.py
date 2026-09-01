from flask import Flask, redirect, url_for, request, session, jsonify, send_file
from flask_cors import CORS  # Import the CORS extension
from flask_login import LoginManager, login_user, logout_user, current_user, login_required
from werkzeug.utils import secure_filename
from werkzeug.middleware.proxy_fix import ProxyFix
import os
import json
import shutil
import secrets
import uuid
import random
import string
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from extensions import db
from googleapiclient.errors import HttpError
from models import init_db, User, Document, CustomPrompt, InvitationLink, ClassroomSession, SessionParticipant, SessionQuery, SessionStage, AvailableModel, UsageLog, OpenRouterBalanceSnapshot, Institution, Grade, UserGrade
from openrouter_usage import create_usage_log, sync_missing_costs, fetch_openrouter_credits
from google_classroom import (
    get_credentials_for_user,
    refresh_credentials,
    list_teacher_courses,
    list_coursework,
    create_google_doc,
    create_coursework_with_materials,
    create_coursework_material,
    create_coursework,
    list_my_submissions,
    add_submission_drive_attachment,
    turn_in_submission,
)
from authlib.integrations.flask_client import OAuth
from urllib.parse import urljoin, urlparse

# Admin configuration from environment variables
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD')

def is_admin_user(user_or_username=None) -> bool:
    """Check if the given user/username is an admin (env admin or DB flag)."""
    if isinstance(user_or_username, User):
        user = user_or_username
        if user.is_admin:
            return True
        username = user.username
    else:
        username = user_or_username
        user = None

    if username and username.lower() == ADMIN_USERNAME.lower():
        return True

    if user is None and username:
        user = User.query.filter(db.func.lower(User.username) == username.lower()).first()

    return bool(user and user.is_admin)

def require_teacher():
    """Verify current user is authenticated and can create sessions."""
    if not current_user.is_authenticated:
        return jsonify({'message': 'Not authenticated'}), 401
    if not current_user.can_create_sessions:
        return jsonify({'message': 'Teacher access required'}), 403
    return None


def is_student_in_any_grade(user) -> bool:
    """Check if the user is a student in any grade (and not a teacher)."""
    if not user or not getattr(user, 'email', None):
        return False
    email = user.email.lower()
    is_student = UserGrade.query.filter(
        db.func.lower(UserGrade.email) == email,
        UserGrade.role == 'student'
    ).first() is not None
    if not is_student:
        return False
    is_teacher = UserGrade.query.filter(
        db.func.lower(UserGrade.email) == email,
        UserGrade.role == 'teacher'
    ).first() is not None
    return not is_teacher


def get_admin_user():
    """Get admin user from environment variable or create default."""
    if ADMIN_USERNAME and ADMIN_PASSWORD:
        return {
            'username': ADMIN_USERNAME,
            'password': ADMIN_PASSWORD,
            'email': f'{ADMIN_USERNAME}@app.local',
            'name': 'Administrator'
        }
    return None

# Load environment variables from .env file in project root
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(env_path)
import logging
logging.debug(f"Loading .env from: {env_path}")

# Initialize Flask app
app = Flask(__name__, static_folder='../frontend/public')
# Trust reverse proxy headers (X-Forwarded-Proto, X-Forwarded-For)
# Required when running behind Caddy/Nginx with SSL termination
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
instance_path_env = os.getenv("FLASK_INSTANCE_PATH")
if instance_path_env:
    app.instance_path = instance_path_env

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY') or 'dev'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'connect_args': {'check_same_thread': False}
}

def _is_secure_environment() -> bool:
    backend_url = os.getenv('BACKEND_URL', '')
    return backend_url.startswith('https://')

app.config['PREFERRED_URL_SCHEME'] = 'https' if _is_secure_environment() else 'http'

def _derive_cookie_domain():
    explicit = os.getenv('SESSION_COOKIE_DOMAIN')
    if explicit:
        return explicit

    hosts = []
    for env_key in ('FRONTEND_URL', 'BACKEND_URL'):
        url_value = os.getenv(env_key, '')
        if not url_value:
            continue
        hostname = urlparse(url_value).hostname
        if hostname:
            hosts.append(hostname)

    for host in hosts:
        if host in {"localhost", "127.0.0.1"} or host.endswith('.local'):
            continue
        parts = host.split('.')
        if len(parts) >= 2:
            return '.' + '.'.join(parts[-2:])

    if hosts:
        fallback = hosts[0]
        if fallback not in {"localhost", "127.0.0.1"} and not fallback.endswith('.local'):
            return fallback

    return None


# Only set cookie domain if explicitly provided
explicit_cookie_domain = os.getenv('SESSION_COOKIE_DOMAIN')
if explicit_cookie_domain:
    app.config['SESSION_COOKIE_DOMAIN'] = explicit_cookie_domain
    app.logger.info(f"[Config] Session cookie domain set from env: {explicit_cookie_domain}")
else:
    # Let browser use default for localhost/internal URLs
    app.logger.info("[Config] Using default session cookie domain (no domain set)")

# Set cookie security settings
session_cookie_secure = os.getenv('SESSION_COOKIE_SECURE')
if session_cookie_secure:
    app.config['SESSION_COOKIE_SECURE'] = session_cookie_secure.lower() == 'true'
else:
    app.config['SESSION_COOKIE_SECURE'] = _is_secure_environment()

if os.getenv('SESSION_COOKIE_SAMESITE'):
    app.config['SESSION_COOKIE_SAMESITE'] = os.getenv('SESSION_COOKIE_SAMESITE')
else:
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

os.makedirs(app.instance_path, exist_ok=True)

# Configure CORS with environment variables
allowed_origins = [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://localhost:5000",
    os.getenv('FRONTEND_URL', ''),
    os.getenv('BACKEND_URL', '')
]
# Remove empty strings
allowed_origins = [o for o in allowed_origins if o]

CORS(app, resources={
    r"/*": {
        "origins": allowed_origins,
        "supports_credentials": True,
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type", "Authorization"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    },
    "/query": {
        "origins": allowed_origins,
        "supports_credentials": True,
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type", "Authorization"],
        "methods": ["POST"]
    }    
})

# Initialize extensions
db.init_app(app)

def _run_migrations():
    """Run lightweight schema migrations for SQLite."""
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(db.engine)
        columns = [c['name'] for c in inspector.get_columns('users')]
        if 'can_create_sessions' not in columns:
            with db.engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN can_create_sessions BOOLEAN DEFAULT 0"))
                conn.commit()
            app.logger.info("[Migration] Added can_create_sessions column to users")
    except Exception as e:
        app.logger.warning(f"[Migration] Skipped: {e}")

with app.app_context():
    _run_migrations()
    db.create_all()
    # Seed available models if empty
    if AvailableModel.query.count() == 0:
        default_models = [
            AvailableModel(slug='google/gemini-2.5-flash', label='Google Gemini'),
            AvailableModel(slug='mistralai/mistral-nemo', label='Mistral Nemo'),
            AvailableModel(slug='deepseek/deepseek-chat-v3-0324', label='DeepSeek'),
            AvailableModel(slug='qwen/qwen-2.5-7b-instruct', label='Qwen 2.5 7B'),
            AvailableModel(slug='meta-llama/llama-3.3-70b-instruct', label='Llama 3.3 70B'),
            AvailableModel(slug='openai/gpt-4o-mini', label='GPT-4o Mini'),
        ]
        for m in default_models:
            db.session.add(m)
        db.session.commit()
        app.logger.info("[Migration] Seeded default available models")

# Enable SQLite WAL mode for better concurrent read/write performance
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    try:
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()
    except Exception:
        # Not a SQLite connection (e.g., PostgreSQL), skip silently
        pass

login_manager = LoginManager(app)
login_manager.login_view = 'login'

# Custom unauthorized handler for API routes
@login_manager.unauthorized_handler
def unauthorized():
    # Return JSON for API routes, redirect for HTML routes
    if request.path.startswith('/api/'):
        return jsonify({'message': 'Not authenticated'}), 401
    # For non-API routes, redirect to login
    return redirect(url_for('login'))

# Initialize OAuth
oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=os.getenv('GOOGLE_CLIENT_ID'),
    client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    access_token_url='https://accounts.google.com/o/oauth2/token',
    access_token_params=None,
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    authorize_params={
        'prompt': 'consent',
        'access_type': 'offline'
    },
    api_base_url='https://www.googleapis.com/oauth2/v1/',
    client_kwargs={
        'scope': ' '.join([
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/classroom.courses.readonly',
            'https://www.googleapis.com/auth/classroom.coursework.students',
            'https://www.googleapis.com/auth/classroom.coursework.me',
            'https://www.googleapis.com/auth/classroom.courseworkmaterials',
            'https://www.googleapis.com/auth/drive.file',
        ]),
        'token_endpoint_auth_method': 'client_secret_post'
    },
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    jwks_uri='https://www.googleapis.com/oauth2/v3/certs',
    issuer='https://accounts.google.com',
    validate_iss=True,
    validate_aud=True
)

# Import models after db initialization to avoid circular imports
from models import User, Document, Query

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/api/save_document', methods=['POST'])
@login_required
def save_document():
    data = request.get_json()
    content = data.get('content')
    title = data.get('title', 'Untitled Document')

    # Get the current user
    user = current_user
    user_id = user.id if user.is_authenticated else 1

    # Check if a document with the same title already exists for the user
    existing_doc = Document.query.filter_by(user_id=user_id, title=title).first()

    if existing_doc:
        # Update the existing document
        existing_doc.content = content
        db.session.commit()
        return jsonify({'message': 'Document updated successfully'}), 200
    else:
        # Create a new document
        doc = Document(user_id=user_id, title=title, content=content)
        db.session.add(doc)
        db.session.commit()
        return jsonify({'message': 'Document saved successfully'}), 200

@app.route('/')
def index():
    return 'Markdown Editor Backend Running'

def _get_allowed_login_domains():
    domains = os.getenv('ALLOWED_LOGIN_DOMAINS', '').strip()
    if not domains:
        return []
    return [d.strip().lower().lstrip('@') for d in domains.split(',') if d.strip()]


@app.route('/login')
def login():
    redirect_to = request.args.get('redirectTo')
    if redirect_to and redirect_to.startswith('/') and not redirect_to.startswith('//'):
        session['post_login_redirect'] = redirect_to
    elif redirect_to:
        app.logger.warning(f"Ignoring invalid redirectTo parameter: {redirect_to}")

    redirect_uri = f"{os.getenv('BACKEND_URL', '')}/login/callback"
    # redirect_uri = url_for('authorize', _external=True)
    app.logger.debug(f"Initiating OAuth with redirect_uri: {redirect_uri}")

    authorize_kwargs = {
        'state': session.get('_state', 'default'),
        'verify': False  # Temporarily disable state verification
    }
    allowed_domains = _get_allowed_login_domains()
    if len(allowed_domains) == 1:
        authorize_kwargs['hd'] = allowed_domains[0]

    return google.authorize_redirect(
        redirect_uri,
        **authorize_kwargs
    )


@app.route('/api/auth/google/classroom')
@login_required
def google_classroom_auth():
    """Re-authorize the current user with Google Classroom/Drive scopes."""
    redirect_to = request.args.get('redirectTo')
    if redirect_to and redirect_to.startswith('/') and not redirect_to.startswith('//'):
        session['post_login_redirect'] = redirect_to

    redirect_uri = f"{os.getenv('BACKEND_URL', '')}/login/callback"
    return google.authorize_redirect(
        redirect_uri,
        state=session.get('_state', 'default'),
        verify=False,
        access_type='offline',
        prompt='consent',
        include_granted_scopes='true',
    )


@app.route('/login/callback')
def authorize():
    try:
        app.logger.debug(f"Callback received with args: {request.args}")
        
        # Manual OAuth token exchange
        code = request.args.get('code')
        if not code:
            raise ValueError("No authorization code received")
            
        # Exchange code for tokens
        token_url = 'https://oauth2.googleapis.com/token'

        redirect_uri = f"{os.getenv('BACKEND_URL', '')}/login/callback"
        app.logger.debug(f"[CALLBACK] Exchanging token with redirect_uri: {redirect_uri}")

        token_data = {
            'code': code,
            'client_id': os.getenv('GOOGLE_CLIENT_ID'),
            'client_secret': os.getenv('GOOGLE_CLIENT_SECRET'),
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code'
        }
        
        token_response = requests.post(token_url, data=token_data)
        app.logger.debug(f"Token exchange response: {token_response.text}")
        token_response.raise_for_status()
        token = token_response.json()
        app.logger.debug(f"Manual token exchange response: {token}")
        
        # Get user info with access token
        headers = {'Authorization': f'Bearer {token["access_token"]}'}
        user_response = requests.get('https://www.googleapis.com/oauth2/v3/userinfo', headers=headers)
        user_response.raise_for_status()
        user_info = user_response.json()
        app.logger.debug(f"User info: {user_info}")
        
        # Verify required claims
        if not user_info.get('email_verified', False):
            raise ValueError("Email not verified by Google")
            
        # Find or create user
        google_id = user_info['sub']
        email = user_info['email']
        name = user_info.get('name', email)

        # Validate allowed email domains
        allowed_domains = _get_allowed_login_domains()
        if allowed_domains:
            email_domain = email.split('@')[-1].lower()
            if email_domain not in allowed_domains:
                app.logger.warning(f"Login rejected for email domain: {email_domain}")
                frontend_url = os.getenv('FRONTEND_URL', '')
                error_target = f"{frontend_url.rstrip('/')}/auth?error=dominio_no_permitido" if frontend_url else '/auth?error=dominio_no_permitido'
                return redirect(error_target)

        app.logger.debug(f"Looking up user with Google ID: {google_id}")
        user = User.query.filter_by(google_id=google_id).first()
        
        if not user:
            app.logger.debug(f"Creating new user with email: {email}")
            user = User(
                google_id=google_id,
                email=email,
                name=name
            )
            db.session.add(user)
            db.session.commit()
        
        if 'refresh_token' in token:
            user.google_refresh_token = token['refresh_token']

        # Link pending grade memberships by email
        pending_memberships = UserGrade.query.filter(
            db.func.lower(UserGrade.email) == user.email.lower(),
            UserGrade.user_id.is_(None)
        ).all()
        for membership in pending_memberships:
            membership.user_id = user.id

        # If user is a teacher in any grade, ensure can_create_sessions
        is_teacher_any = UserGrade.query.filter(
            db.func.lower(UserGrade.email) == user.email.lower(),
            UserGrade.role == 'teacher'
        ).first() is not None
        if is_teacher_any:
            user.can_create_sessions = True

        db.session.commit()
        login_user(user)

        frontend_url = os.getenv('FRONTEND_URL', '')
        redirect_path = session.pop('post_login_redirect', None)
        target_url = frontend_url or '/'

        if redirect_path and redirect_path.startswith('/') and not redirect_path.startswith('//'):
            if frontend_url:
                base_frontend = frontend_url.rstrip('/') + '/'
                target_url = urljoin(base_frontend, redirect_path.lstrip('/'))
            else:
                target_url = redirect_path

        app.logger.debug(f"Redirecting authenticated user to: {target_url}")
        return redirect(target_url)

    except Exception as e:
        app.logger.error(f"OAuth error: {str(e)}")
        return f"Authentication failed: {str(e)}", 400

def _clear_session_cookies(response):
    cookie_name = app.config.get('SESSION_COOKIE_NAME', 'session')
    cookie_domain = app.config.get('SESSION_COOKIE_DOMAIN')
    cookie_path = app.config.get('SESSION_COOKIE_PATH', '/')
    cookie_samesite = app.config.get('SESSION_COOKIE_SAMESITE')
    cookie_secure = app.config.get('SESSION_COOKIE_SECURE', False)

    response.delete_cookie(
        cookie_name,
        domain=cookie_domain,
        path=cookie_path,
        samesite=cookie_samesite,
        secure=cookie_secure,
    )

    return response


def _wants_json_response() -> bool:
    best = request.accept_mimetypes.best_match(['application/json', 'text/html'])
    if not best:
        return False
    return best == 'application/json' and request.accept_mimetypes[best] > request.accept_mimetypes['text/html']


@app.route('/logout', methods=['GET', 'POST'])
def logout():
    logout_user()
    session.clear()

    if _wants_json_response() or request.is_json or request.method == 'POST':
        response = jsonify({'success': True})
    else:
        frontend_url = os.getenv('FRONTEND_URL')
        target = frontend_url or '/login'
        response = redirect(target)

    return _clear_session_cookies(response)

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'}), 200

@app.route('/api/check-auth', methods=['GET'])
def check_auth():
    user = current_user
    app.logger.info(f"[Auth Check] Session: {dict(session)}")
    app.logger.info(f"[Auth Check] User: {user}, Authenticated: {user.is_authenticated if hasattr(user, 'is_authenticated') else 'no attr'}")
    
    if hasattr(user, 'is_authenticated') and user.is_authenticated:
        can_create_prompts = getattr(user, 'can_create_prompts', True)
        if is_student_in_any_grade(user):
            can_create_prompts = False
        return jsonify({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'name': user.name,
            'can_create_sessions': user.can_create_sessions,
            'can_create_prompts': can_create_prompts,
            'can_create_invites': user.can_create_invites,
            'is_admin': is_admin_user(user),
            'is_teacher': user.can_create_sessions or is_admin_user(user),
        })
    else:
        return jsonify({'message': 'Not authenticated'}), 401

@app.route('/api/local-login', methods=['POST'])
def local_login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400

    user = None

    # Admin from environment variables
    if username == ADMIN_USERNAME and ADMIN_PASSWORD and password == ADMIN_PASSWORD:
        user = User.query.filter(
            (User.username == ADMIN_USERNAME) | (User.email == f'{ADMIN_USERNAME}@app.local')
        ).first()
        if user:
            user.name = 'Administrator'
            user.set_password(ADMIN_PASSWORD)
            db.session.commit()
        else:
            try:
                user = User(
                    username=ADMIN_USERNAME,
                    email=f'{ADMIN_USERNAME}@app.local',
                    name='Administrator'
                )
                user.set_password(ADMIN_PASSWORD)
                db.session.add(user)
                db.session.commit()
            except IntegrityError:
                db.session.rollback()
                app.logger.error("[Login] IntegrityError creating admin user")
                return jsonify({'error': 'User conflict. Please contact support.'}), 500
    else:
        # Check database directly for users created via OAuth or invitations
        user = User.query.filter(
            (User.username == username) | (User.email == username)
        ).first()
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        if not user.check_password(password):
            return jsonify({'error': 'Invalid credentials'}), 401

    # Check database-level disabled / trial expiry
    if user.is_disabled:
        return jsonify({'error': 'Cuenta deshabilitada. Escribinos a hola@laia.ar para seguir probando y charlando. :)'}), 403

    if user.trial_expires_at and datetime.utcnow() > user.trial_expires_at:
        user.is_disabled = True
        db.session.commit()
        return jsonify({'error': 'Tu período de prueba de 15 días ha expirado. Escribinos a hola@laia.ar para seguir probando y charlando. :)'}), 403

    login_user(user)

    # Debug logging
    app.logger.info(f"[Login] User {user.username} logged in successfully")
    app.logger.info(f"[Login] Session cookie settings: domain={app.config.get('SESSION_COOKIE_DOMAIN')}, secure={app.config.get('SESSION_COOKIE_SECURE')}, samesite={app.config.get('SESSION_COOKIE_SAMESITE')}")

    can_create_prompts = getattr(user, 'can_create_prompts', True)
    if is_student_in_any_grade(user):
        can_create_prompts = False

    return jsonify({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'name': user.name,
        'can_create_sessions': user.can_create_sessions,
        'can_create_prompts': can_create_prompts,
        'can_create_invites': user.can_create_invites,
        'is_admin': is_admin_user(username)
    })

@app.route('/api/admin/dashboard', methods=['GET'])
@login_required
def admin_dashboard():
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    
    # Get detailed stats
    total_users = User.query.count()
    total_documents = Document.query.count()
    total_prompts = CustomPrompt.query.count()
    public_prompts = CustomPrompt.query.filter_by(public=True).count()
    total_queries = Query.query.count()
    
    return jsonify({
        'stats': {
            'total_users': total_users,
            'documents': total_documents,
            'prompts': total_prompts,
            'public_prompts': public_prompts,
            'queries': total_queries
        }
    })

@app.route('/api/admin/usage/sync-costs', methods=['POST'])
@login_required
def admin_sync_usage_costs():
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    try:
        result = sync_missing_costs(limit=100)
        return jsonify(result)
    except Exception as e:
        app.logger.error(f"Failed to sync usage costs: {e}")
        return jsonify({'error': 'Failed to sync costs'}), 500


@app.route('/api/admin/openrouter/credits', methods=['GET'])
@login_required
def admin_openrouter_credits():
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403

    credits = fetch_openrouter_credits()
    if not credits:
        return jsonify({'error': 'No se pudieron obtener los créditos de OpenRouter'}), 502

    snapshot = OpenRouterBalanceSnapshot(
        total_credits=credits['total_credits'],
        total_usage=credits['total_usage'],
        balance_usd=credits['balance_usd'],
    )
    db.session.add(snapshot)
    db.session.commit()

    return jsonify({
        'total_credits': float(credits['total_credits']),
        'total_usage': float(credits['total_usage']),
        'balance_usd': float(credits['balance_usd']),
        'checked_at': snapshot.checked_at.isoformat(),
    })


@app.route('/api/admin/openrouter/credits/history', methods=['GET'])
@login_required
def admin_openrouter_credits_history():
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403

    snapshots = OpenRouterBalanceSnapshot.query.order_by(OpenRouterBalanceSnapshot.checked_at.desc()).limit(100).all()
    return jsonify({
        'history': [{
            'total_credits': float(s.total_credits),
            'total_usage': float(s.total_usage),
            'balance_usd': float(s.balance_usd),
            'checked_at': s.checked_at.isoformat(),
        } for s in reversed(snapshots)]
    })


@app.route('/api/admin/usage/summary', methods=['GET'])
@login_required
def admin_usage_summary():
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403

    from sqlalchemy import func

    rows = (
        db.session.query(
            User.id,
            User.username,
            User.name,
            func.coalesce(func.sum(UsageLog.total_tokens), 0).label('total_tokens'),
            func.coalesce(func.sum(UsageLog.cost_usd), 0).label('total_cost_usd'),
            func.coalesce(func.count(UsageLog.id), 0).label('total_queries'),
        )
        .outerjoin(UsageLog, UsageLog.user_id == User.id)
        .group_by(User.id)
        .order_by(func.coalesce(func.sum(UsageLog.cost_usd), 0).desc())
        .all()
    )

    return jsonify({
        'users': [{
            'id': row.id,
            'username': row.username,
            'name': row.name,
            'total_tokens': int(row.total_tokens),
            'total_cost_usd': float(row.total_cost_usd) if row.total_cost_usd else 0.0,
            'total_queries': int(row.total_queries),
        } for row in rows]
    })


@app.route('/api/admin/usage/over-time', methods=['GET'])
@login_required
def admin_usage_over_time():
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403

    group_by = request.args.get('group_by', 'day')
    if group_by not in ('day', 'week', 'month'):
        group_by = 'day'

    from sqlalchemy import func

    if group_by == 'day':
        period_expr = func.strftime('%Y-%m-%d', UsageLog.created_at)
    elif group_by == 'week':
        period_expr = func.strftime('%Y-%W', UsageLog.created_at)
    else:
        period_expr = func.strftime('%Y-%m', UsageLog.created_at)

    rows = (
        db.session.query(
            period_expr.label('period'),
            func.coalesce(func.sum(UsageLog.total_tokens), 0).label('total_tokens'),
            func.coalesce(func.sum(UsageLog.cost_usd), 0).label('total_cost_usd'),
            func.coalesce(func.count(UsageLog.id), 0).label('total_queries'),
        )
        .group_by(period_expr)
        .order_by(period_expr)
        .all()
    )

    return jsonify({
        'group_by': group_by,
        'data': [{
            'period': row.period,
            'total_tokens': int(row.total_tokens),
            'total_cost_usd': float(row.total_cost_usd) if row.total_cost_usd else 0.0,
            'total_queries': int(row.total_queries),
        } for row in rows]
    })


@app.route('/api/admin/users', methods=['GET'])
@login_required
def admin_users():
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    
    users = User.query.all()
    return jsonify({
        'users': [{
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'name': user.name,
            'is_admin': is_admin_user(user),
            'can_create_sessions': user.can_create_sessions,
            'can_create_prompts': getattr(user, 'can_create_prompts', True),
            'can_create_invites': user.can_create_invites
        } for user in users]
    })

@app.route('/api/admin/users/<int:user_id>/features', methods=['PUT'])
@login_required
def admin_user_features(user_id):
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if 'can_create_invites' in data:
        user.can_create_invites = bool(data['can_create_invites'])

    if 'can_create_prompts' in data:
        user.can_create_prompts = bool(data['can_create_prompts'])

    if 'is_admin' in data:
        # Prevent self-demotion
        if current_user.id == user.id and not bool(data['is_admin']):
            return jsonify({'error': 'No podés quitarte el rol de administrador a vos mismo'}), 400
        user.is_admin = bool(data['is_admin'])

    db.session.commit()

    return jsonify({
        'id': user.id,
        'username': user.username,
        'is_admin': is_admin_user(user),
        'can_create_invites': user.can_create_invites,
        'can_create_prompts': getattr(user, 'can_create_prompts', True),
        'can_create_sessions': user.can_create_sessions,
    })


@app.route('/api/admin/prompts', methods=['GET'])
@login_required
def admin_list_prompts():
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403

    prompts = CustomPrompt.query.order_by(CustomPrompt.name).all()
    return jsonify({
        'prompts': [{
            'id': p.id,
            'name': p.name,
            'content': p.content,
            'public': p.public,
            'user_id': p.user_id,
            'created_at': p.created_at.isoformat() if p.created_at else None,
        } for p in prompts]
    })


@app.route('/api/admin/prompts/<int:prompt_id>/public', methods=['PUT'])
@login_required
def admin_toggle_prompt_public(prompt_id):
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    prompt = CustomPrompt.query.get_or_404(prompt_id)
    prompt.public = bool(data.get('public', not prompt.public))
    db.session.commit()

    return jsonify({
        'id': prompt.id,
        'name': prompt.name,
        'public': prompt.public,
    })


# Institution and grade management endpoints


@app.route('/api/admin/institutions', methods=['GET'])
@login_required
def admin_list_institutions():
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    institutions = Institution.query.order_by(Institution.name).all()
    return jsonify({
        'institutions': [{
            'id': i.id,
            'name': i.name,
            'created_at': i.created_at.isoformat() if i.created_at else None,
        } for i in institutions]
    })


@app.route('/api/admin/institutions', methods=['POST'])
@login_required
def admin_create_institution():
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    data = request.get_json()
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    if Institution.query.filter_by(name=name).first():
        return jsonify({'error': 'Institution already exists'}), 409
    institution = Institution(name=name)
    db.session.add(institution)
    db.session.commit()
    return jsonify({
        'id': institution.id,
        'name': institution.name,
        'created_at': institution.created_at.isoformat(),
    }), 201


@app.route('/api/admin/institutions/<int:institution_id>', methods=['PUT'])
@login_required
def admin_update_institution(institution_id):
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    institution = Institution.query.get_or_404(institution_id)
    data = request.get_json()
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    institution.name = name
    db.session.commit()
    return jsonify({
        'id': institution.id,
        'name': institution.name,
    })


@app.route('/api/admin/institutions/<int:institution_id>', methods=['DELETE'])
@login_required
def admin_delete_institution(institution_id):
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    institution = Institution.query.get_or_404(institution_id)
    db.session.delete(institution)
    db.session.commit()
    return '', 204


@app.route('/api/admin/institutions/<int:institution_id>/grades', methods=['GET'])
@login_required
def admin_list_grades(institution_id):
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    Institution.query.get_or_404(institution_id)
    grades = Grade.query.filter_by(institution_id=institution_id).order_by(Grade.name).all()
    return jsonify({
        'grades': [{
            'id': g.id,
            'name': g.name,
            'created_at': g.created_at.isoformat() if g.created_at else None,
        } for g in grades]
    })


@app.route('/api/admin/institutions/<int:institution_id>/grades', methods=['POST'])
@login_required
def admin_create_grade(institution_id):
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    Institution.query.get_or_404(institution_id)
    data = request.get_json()
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    if Grade.query.filter_by(institution_id=institution_id, name=name).first():
        return jsonify({'error': 'Grade already exists in this institution'}), 409
    grade = Grade(institution_id=institution_id, name=name)
    db.session.add(grade)
    db.session.commit()
    return jsonify({
        'id': grade.id,
        'name': grade.name,
        'institution_id': grade.institution_id,
    }), 201


@app.route('/api/admin/grades/<int:grade_id>', methods=['PUT'])
@login_required
def admin_update_grade(grade_id):
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    grade = Grade.query.get_or_404(grade_id)
    data = request.get_json()
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    existing = Grade.query.filter_by(institution_id=grade.institution_id, name=name).first()
    if existing and existing.id != grade.id:
        return jsonify({'error': 'Grade already exists in this institution'}), 409
    grade.name = name
    db.session.commit()
    return jsonify({
        'id': grade.id,
        'name': grade.name,
    })


@app.route('/api/admin/grades/<int:grade_id>', methods=['DELETE'])
@login_required
def admin_delete_grade(grade_id):
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    grade = Grade.query.get_or_404(grade_id)
    db.session.delete(grade)
    db.session.commit()
    return '', 204


@app.route('/api/admin/grades/<int:grade_id>/members', methods=['GET'])
@login_required
def admin_list_grade_members(grade_id):
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    Grade.query.get_or_404(grade_id)
    members = UserGrade.query.filter_by(grade_id=grade_id).order_by(UserGrade.email).all()
    return jsonify({
        'members': [{
            'id': m.id,
            'email': m.email,
            'role': m.role,
            'user_id': m.user_id,
        } for m in members]
    })


@app.route('/api/admin/grades/<int:grade_id>/members', methods=['POST'])
@login_required
def admin_add_grade_member(grade_id):
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    grade = Grade.query.get_or_404(grade_id)
    data = request.get_json()
    email = (data.get('email') or '').strip().lower()
    role = data.get('role', 'student')
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    if role not in ('teacher', 'student'):
        return jsonify({'error': 'Role must be teacher or student'}), 400
    existing = UserGrade.query.filter_by(grade_id=grade_id, email=email).first()
    if existing:
        return jsonify({'error': 'Email already assigned to this grade'}), 409
    user = User.query.filter(db.func.lower(User.email) == email).first()
    member = UserGrade(
        grade_id=grade_id,
        email=email,
        user_id=user.id if user else None,
        role=role,
    )
    db.session.add(member)
    db.session.commit()
    return jsonify({
        'id': member.id,
        'email': member.email,
        'role': member.role,
        'user_id': member.user_id,
    }), 201


@app.route('/api/admin/grades/<int:grade_id>/members/<int:member_id>', methods=['DELETE'])
@login_required
def admin_remove_grade_member(grade_id, member_id):
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    Grade.query.get_or_404(grade_id)
    member = UserGrade.query.filter_by(id=member_id, grade_id=grade_id).first_or_404()
    db.session.delete(member)
    db.session.commit()
    return '', 204


@app.route('/api/admin/download-db', methods=['GET'])
@login_required
def download_db():
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    
    db_path = os.path.join(app.instance_path, 'app.db')
    return send_file(
        db_path,
        as_attachment=True,
        download_name='caliope_app.db',
        mimetype='application/x-sqlite3'
    )

@app.route('/api/admin/upload-db', methods=['POST'])
@login_required
def upload_db():
    """Upload and replace the SQLite database."""
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Validate file extension
    if not file.filename.endswith('.db'):
        return jsonify({'error': 'Invalid file type. Only .db files are allowed'}), 400
    
    db_path = os.path.join(app.instance_path, 'app.db')
    backup_path = os.path.join(app.instance_path, 'app.db.backup')
    
    try:
        # Save uploaded file temporarily first (before closing connections)
        temp_path = os.path.join(app.instance_path, 'temp_upload.db')
        file.save(temp_path)
        
        # Validate it's a valid SQLite database
        import sqlite3
        try:
            conn = sqlite3.connect(temp_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            conn.close()
            
            if not tables:
                os.remove(temp_path)
                return jsonify({'error': 'Invalid SQLite database: no tables found'}), 400
            
            app.logger.info(f"[Upload DB] Valid SQLite database with tables: {[t[0] for t in tables]}")
        except sqlite3.Error as e:
            os.remove(temp_path)
            return jsonify({'error': f'Invalid SQLite database: {str(e)}'}), 400
        
        # CRITICAL: Close all SQLAlchemy connections before replacing the file
        db.session.remove()
        db.engine.dispose()
        app.logger.info("[Upload DB] Database connections closed")
        
        # Create backup of current database
        if os.path.exists(db_path):
            shutil.copy2(db_path, backup_path)
            app.logger.info(f"[Upload DB] Backup created at {backup_path}")
        
        # Replace current database with uploaded one
        shutil.move(temp_path, db_path)
        
        # SQLAlchemy will automatically reconnect on next request
        # No need to manually recreate the engine
        
        app.logger.info(f"[Upload DB] Database replaced successfully by {current_user.username}")
        
        return jsonify({
            'success': True,
            'message': 'Database uploaded successfully. La página se recargará para reflejar los cambios.',
            'tables': [t[0] for t in tables],
            'backup_created': os.path.exists(backup_path),
            'reload_required': True
        })
        
    except Exception as e:
        app.logger.error(f"[Upload DB] Error: {str(e)}")
        # Try to restore backup if something went wrong
        if os.path.exists(backup_path) and os.path.exists(db_path) is False:
            try:
                shutil.copy2(backup_path, db_path)
                app.logger.info("[Upload DB] Database restored from backup after error")
            except Exception as restore_error:
                app.logger.error(f"[Upload DB] Failed to restore backup: {restore_error}")
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500

# Document API Endpoints
@app.route('/api/documents', methods=['GET'])
@login_required
def get_documents():
    user = current_user
    user_id = user.id if user.is_authenticated else 1
    documents = Document.query.filter_by(user_id=user_id).all()
    return {
        'documents': [{
            'id': doc.id,
            'title': doc.title,
            'updated_at': doc.updated_at.isoformat()
        } for doc in documents]
    }

@app.route('/api/documents', methods=['POST'])
@login_required
def create_document():
    try:
        data = request.get_json()
        user = current_user
        user_id = user.id if user.is_authenticated else 1
        
        app.logger.info(f"[Create Doc] User {user_id} creating document: {data.get('title', 'Untitled')}")
        
        doc = Document(
            user_id=user_id,
            title=data.get('title', 'Untitled Document'),
            content=data.get('content', '')
        )
        db.session.add(doc)
        db.session.commit()
        
        app.logger.info(f"[Create Doc] Document {doc.id} created successfully")
        
        return {
            'id': doc.id,
            'title': doc.title,
            'content': doc.content,
            'created_at': doc.created_at.isoformat()
        }, 201
    except Exception as e:
        app.logger.error(f"[Create Doc] Error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/documents/<int:doc_id>', methods=['GET'])
@login_required
def get_document(doc_id):
    user = current_user
    user_id = user.id if user.is_authenticated else 1
    doc = Document.query.filter_by(id=doc_id, user_id=user_id).first_or_404()
    return {
        'id': doc.id,
        'title': doc.title,
        'content': doc.content,
        'created_at': doc.created_at.isoformat(),
        'updated_at': doc.updated_at.isoformat()
    }

@app.route('/api/documents/<int:doc_id>', methods=['PUT'])
@login_required
def update_document(doc_id):
    user = current_user
    user_id = user.id if user.is_authenticated else 1
    doc = Document.query.filter_by(id=doc_id, user_id=user_id).first_or_404()
    data = request.get_json()
    doc.title = data.get('title', doc.title)
    doc.content = data.get('content', doc.content)
    db.session.commit()
    return {
        'id': doc.id,
        'title': doc.title,
        'content': doc.content,
        'updated_at': doc.updated_at.isoformat()
    }

@app.route('/api/documents/<int:doc_id>', methods=['DELETE'])
@login_required
def delete_document(doc_id):
    user = current_user
    doc = Document.query.filter_by(id=doc_id).first_or_404()
    user_id = user.id if user.is_authenticated else 1
    if doc.user_id != user_id:
        return jsonify({'message': 'You are not authorized to delete this document'}), 403
    db.session.delete(doc)
    db.session.commit()
    return '', 204

# Prompt API Endpoints
@app.route('/api/prompts', methods=['GET'])
@login_required
def get_prompts():
    app.logger.debug(f"Calling get_prompts()")
    user = current_user
    user_id = user.id if user.is_authenticated else 1
    # Get both user's prompts and public prompts from others
    prompts = CustomPrompt.query.filter(
        (CustomPrompt.user_id == user_id) | (CustomPrompt.public == True)
    ).all()
    return {
        'prompts': [{
            'id': prompt.id,
            'name': prompt.name,
            'updated_at': prompt.updated_at.isoformat(),
            'public': prompt.public
        } for prompt in prompts]
    }

@app.route('/api/prompts', methods=['POST'])
@login_required
def create_prompt():
    data = request.get_json()
    user = current_user
    if is_student_in_any_grade(user) and not is_admin_user(user):
        return jsonify({'error': 'Los estudiantes no pueden crear prompts'}), 403
    if not getattr(user, 'can_create_prompts', True) and not is_admin_user(user):
        return jsonify({'error': 'No tenés permiso para crear prompts'}), 403
    user_id = user.id if user.is_authenticated else 1
    prompt = CustomPrompt(
        user_id=user_id,
        name=data['name'],
        content=data['content'],
        public=data.get('public', False)
    )
    db.session.add(prompt)
    db.session.commit()
    return {
        'id': prompt.id,
        'name': prompt.name,
        'content': prompt.content,
        'public': prompt.public,
        'created_at': prompt.created_at.isoformat()
    }, 201

@app.route('/api/prompts/<int:prompt_id>', methods=['GET'])
@login_required
def get_prompt(prompt_id):
    user = current_user
    user_id = user.id if user.is_authenticated else 1
    
    # First try to find prompt owned by user
    prompt = CustomPrompt.query.filter_by(id=prompt_id, user_id=user_id).first()
    
    # If not found, check for public prompt
    if not prompt:
        prompt = CustomPrompt.query.filter_by(id=prompt_id, public=True).first_or_404()
        return {
            'id': prompt.id,
            'name': prompt.name,
            'content': prompt.content,
            'public': prompt.public,
            'created_at': prompt.created_at.isoformat(),
            'updated_at': prompt.updated_at.isoformat(),
            'is_owner': False
        }
    
    return {
        'id': prompt.id,
        'name': prompt.name,
        'content': prompt.content,
        'public': prompt.public,
        'created_at': prompt.created_at.isoformat(),
        'updated_at': prompt.updated_at.isoformat(),
        'is_owner': True
    }

@app.route('/api/prompts/<int:prompt_id>', methods=['PUT'])
@login_required
def update_prompt(prompt_id):
    user = current_user
    user_id = user.id if user.is_authenticated else 1
    prompt = CustomPrompt.query.filter_by(id=prompt_id, user_id=user_id).first_or_404()
    data = request.get_json()
    prompt.name = data.get('name', prompt.name)
    prompt.content = data.get('content', prompt.content)
    prompt.public = data.get('public', prompt.public)
    db.session.commit()
    return {
        'id': prompt.id,
        'name': prompt.name,
        'content': prompt.content,
        'public': prompt.public,
        'updated_at': prompt.updated_at.isoformat()
    }
    db.session.commit()
    return {
        'id': prompt.id,
        'name': prompt.name,
        'content': prompt.content,
        'updated_at': prompt.updated_at.isoformat()
    }

@app.route('/api/prompts/<int:prompt_id>', methods=['DELETE'])
@login_required
def delete_prompt(prompt_id):
    user = current_user
    user_id = user.id if user.is_authenticated else 1
    prompt = CustomPrompt.query.filter_by(id=prompt_id, user_id=user_id).first_or_404()
    db.session.delete(prompt)
    db.session.commit()
    return '', 204

import requests
import os

@app.route('/api/queries/history', methods=['GET'])
@login_required
def get_query_history():
    user = current_user
    user_id = user.id if user.is_authenticated else 1
    document_id = request.args.get('document_id')
    
    # Build query based on whether document_id is provided
    if document_id:
        queries = Query.query.filter_by(user_id=user_id, document_id=document_id).order_by(Query.created_at.desc()).all()
    else:
        queries = Query.query.filter_by(user_id=user_id).order_by(Query.created_at.desc()).all()
    
    return jsonify({
        'queries': [{
            'id': query.id,
            'query_text': query.query_text,
            'response_text': query.response_text,
            'llm_model_name': query.llm_model_name,
            'created_at': query.created_at.isoformat(),
            'document_id': query.document_id
        } for query in queries]
    })

@app.route('/api/query', methods=['POST'])
@login_required
def query():
    data = request.get_json()
    text = data.get('text')
    customprompt_id = data.get('customprompt')
    llm_model_name = data.get('llm_model_name')
    document_id = data.get('document_id')
    
    customprompt = None
    if customprompt_id:
        customprompt = CustomPrompt.query.get(customprompt_id)
    
    customprompt_content = customprompt.content if customprompt else "No custom prompt selected"
    
    import logging
    logging.basicConfig(level=logging.DEBUG)

    # Get OpenRouter API key from environment variables
    openrouter_api_key = os.getenv('OPENROUTER_API_KEY')
    logging.debug(f"OpenRouter API Key: {openrouter_api_key}")
    logging.debug(f"All environment variables: {dict(os.environ)}")
    
    # Construct the request to OpenRouter API
    headers = {
        "Authorization": f"Bearer {openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.getenv('FRONTEND_URL', 'http://127.0.0.1:3000'),
        "X-Title": "Caliope Markdown Editor"
    }
    
    payload = {
            "model": llm_model_name,
            "messages": [
                {"role": "system", "content": "Eres un generador de preguntas. Generas exactamente 3 preguntas. No incluyas nada más que las preguntas separadas por un salto de linea, sin explicaciones ni contenido adicional. A continuación recibirás instrucciones sobre el rol que debes adoptar para hacer las preguntas."},
                {"role": "system", "content": customprompt_content},
                {"role": "user", "content": text}
            ]
        }
    logging.debug(f"Payload: {payload}")
    
    try:
        logging.debug(f"Final headers being sent: {headers}")
        logging.debug(f"Final payload being sent: {payload}")
        
        response = requests.post("https://openrouter.ai/api/v1/chat/completions", 
                                headers=headers, 
                                json=payload,
                                timeout=30)
        response.raise_for_status()
        
        response_data = response.json()
        logging.debug(f"Full response: {response_data}")
        message = response_data['choices'][0]['message']['content']
        generation_id = response_data.get('id')
        
        # Save the query to the database
        user = current_user
        user_id = user.id if user.is_authenticated else 1
        
        query_record = Query(
            user_id=user_id,
            document_id=document_id if document_id else None,
            query_text=text,
            custom_prompt_id=customprompt_id if customprompt_id else None,
            llm_model_name=llm_model_name,
            response_text=message
        )
        
        db.session.add(query_record)
        db.session.commit()

        # Log OpenRouter usage
        try:
            create_usage_log(
                user_id=user_id,
                query_id=query_record.id,
                session_query_id=None,
                session_participant_id=None,
                model_name=llm_model_name or "unknown",
                generation_id=generation_id,
                response_data=response_data,
            )
        except Exception as e:
            logging.warning(f"Failed to log OpenRouter usage: {e}")
        
        logging.debug(f"Query saved to database with ID: {query_record.id}")
        
        return jsonify({"message": message})
    
    except requests.exceptions.RequestException as e:
        logging.error(f"Request failed. Status: {e.response.status_code if hasattr(e, 'response') else 'N/A'}")
        logging.error(f"Response text: {e.response.text if hasattr(e, 'response') else 'N/A'}")
        logging.error(f"Full error: {str(e)}")
        error_details = {
            "error": str(e),
            "status_code": e.response.status_code if hasattr(e, 'response') else None,
            "response_text": e.response.text if hasattr(e, 'response') else None
        }
        return jsonify(error_details), 500

# ─── Classroom Sessions ───

def _generate_access_code(length=6):
    """Generate a random uppercase alphanumeric access code."""
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))
        if not ClassroomSession.query.filter_by(access_code=code).first():
            return code

def _serialize_session_stages(s):
    """Serialize the ordered stages of a session, including each stage's prompt."""
    stages = SessionStage.query.filter_by(session_id=s.id).order_by(SessionStage.position).all()
    result = []
    for stage in stages:
        prompt = None
        if stage.prompt:
            prompt = {'id': stage.prompt.id, 'name': stage.prompt.name, 'content': stage.prompt.content}
        result.append({
            'id': stage.id,
            'position': stage.position,
            'instructions': stage.instructions,
            'prompt': prompt,
        })
    return result

@app.route('/api/sessions', methods=['POST'])
@login_required
def create_session():
    error = require_teacher()
    if error:
        return error
    data = request.get_json()
    title = data.get('title', '').strip()
    instructions = data.get('instructions', '').strip()
    prompt_id = data.get('custom_prompt_id')
    model_name = data.get('llm_model_name')
    access_level = data.get('access_level', 'guests').strip().lower()
    grade_id = data.get('grade_id')
    stages_data = data.get('stages')
    if access_level not in ('guests', 'registered', 'both'):
        return jsonify({'error': 'Invalid access level'}), 400
    if not title:
        return jsonify({'error': 'Title is required'}), 400
    if not model_name:
        return jsonify({'error': 'Model is required'}), 400
    if stages_data is not None:
        if not isinstance(stages_data, list) or not stages_data:
            return jsonify({'error': 'Se necesita al menos una etapa'}), 400
        stages_data = [
            {
                'instructions': str(stage.get('instructions', '') or '').strip(),
                'custom_prompt_id': stage.get('custom_prompt_id') or None,
            }
            for stage in stages_data
        ]
    else:
        # Clientes viejos: una sola etapa desde los campos planos
        stages_data = [{'instructions': instructions, 'custom_prompt_id': prompt_id or None}]
    if grade_id:
        grade_id = int(grade_id)
        # Verify teacher belongs to the grade
        membership = UserGrade.query.filter_by(
            grade_id=grade_id,
            email=current_user.email.lower(),
            role='teacher',
        ).first()
        if not membership and not is_admin_user(current_user):
            return jsonify({'error': 'No tenés permiso para asignar una tarea a este grado'}), 403
    code = _generate_access_code()
    first_stage = stages_data[0]
    session_obj = ClassroomSession(
        teacher_id=current_user.id,
        grade_id=grade_id,
        title=title,
        instructions=first_stage['instructions'],
        custom_prompt_id=first_stage['custom_prompt_id'],
        llm_model_name=model_name,
        access_code=code,
        access_level=access_level,
        is_active=True
    )
    db.session.add(session_obj)
    db.session.flush()
    for index, stage in enumerate(stages_data, start=1):
        db.session.add(SessionStage(
            session_id=session_obj.id,
            position=index,
            instructions=stage['instructions'],
            custom_prompt_id=stage['custom_prompt_id'],
        ))
    db.session.commit()
    return jsonify({
        'id': session_obj.id,
        'title': session_obj.title,
        'access_code': session_obj.access_code,
        'access_level': session_obj.access_level,
        'grade_id': session_obj.grade_id,
        'is_active': session_obj.is_active,
        'created_at': session_obj.created_at.isoformat()
    }), 201

@app.route('/api/sessions', methods=['GET'])
@login_required
def list_sessions():
    error = require_teacher()
    if error:
        return error
    sessions = ClassroomSession.query.filter_by(teacher_id=current_user.id).order_by(ClassroomSession.created_at.desc()).all()
    result = []
    for s in sessions:
        grade = None
        if s.grade_id:
            g = Grade.query.get(s.grade_id)
            if g:
                grade = {'id': g.id, 'name': g.name, 'institution_id': g.institution_id}
        result.append({
            'id': s.id,
            'title': s.title,
            'access_code': s.access_code,
            'access_level': s.access_level,
            'is_active': s.is_active,
            'llm_model_name': s.llm_model_name,
            'grade': grade,
            'created_at': s.created_at.isoformat()
        })
    return jsonify({'sessions': result})

@app.route('/api/sessions/<int:session_id>', methods=['GET'])
@login_required
def get_session(session_id):
    error = require_teacher()
    if error:
        return error
    s = ClassroomSession.query.filter_by(id=session_id, teacher_id=current_user.id).first_or_404()
    prompt = None
    if s.custom_prompt_id:
        p = CustomPrompt.query.get(s.custom_prompt_id)
        if p:
            prompt = {'id': p.id, 'name': p.name, 'content': p.content}
    grade = None
    if s.grade_id:
        g = Grade.query.get(s.grade_id)
        if g:
            grade = {'id': g.id, 'name': g.name, 'institution_id': g.institution_id}
    submissions = []
    for p in s.participants:
        if p.submitted_at:
            name = p.display_name or (p.user.name if p.user else None) or 'Anónimo'
            submissions.append({
                'participant_id': p.id,
                'participant_name': name,
                'submitted_at': p.submitted_at.isoformat(),
                'submission_url': p.submission_url,
            })
    return jsonify({
        'id': s.id,
        'title': s.title,
        'instructions': s.instructions,
        'access_code': s.access_code,
        'access_level': s.access_level,
        'is_active': s.is_active,
        'llm_model_name': s.llm_model_name,
        'grade': grade,
        'prompt': prompt,
        'stages': _serialize_session_stages(s),
        'classroom_coursework_id': s.classroom_coursework_id,
        'classroom_coursework_url': s.classroom_coursework_url,
        'submissions': submissions,
        'created_at': s.created_at.isoformat(),
        'updated_at': s.updated_at.isoformat()
    })

@app.route('/api/sessions/participated', methods=['GET'])
@login_required
def list_participated_sessions():
    """List classroom sessions where the current user is a participant."""
    sessions = (
        ClassroomSession.query
        .join(SessionParticipant)
        .filter(SessionParticipant.user_id == current_user.id)
        .order_by(ClassroomSession.created_at.desc())
        .all()
    )
    return jsonify({
        'sessions': [{
            'id': s.id,
            'title': s.title,
            'access_code': s.access_code,
            'access_level': s.access_level,
            'is_active': s.is_active,
            'llm_model_name': s.llm_model_name,
            'created_at': s.created_at.isoformat()
        } for s in sessions]
    })

@app.route('/api/sessions/<int:session_id>', methods=['PUT'])
@login_required
def update_session(session_id):
    error = require_teacher()
    if error:
        return error
    s = ClassroomSession.query.filter_by(id=session_id, teacher_id=current_user.id).first_or_404()
    data = request.get_json()
    s.title = data.get('title', s.title)
    if 'instructions' in data:
        s.instructions = str(data.get('instructions') or '').strip()
    s.custom_prompt_id = data.get('custom_prompt_id', s.custom_prompt_id)
    s.llm_model_name = data.get('llm_model_name', s.llm_model_name)
    if 'access_level' in data:
        access_level = str(data['access_level']).strip().lower()
        if access_level not in ('guests', 'registered', 'both'):
            return jsonify({'error': 'Invalid access level'}), 400
        s.access_level = access_level
    if 'is_active' in data:
        s.is_active = bool(data['is_active'])
    if 'grade_id' in data:
        new_grade_id = data['grade_id']
        if new_grade_id:
            new_grade_id = int(new_grade_id)
            membership = UserGrade.query.filter_by(
                grade_id=new_grade_id,
                email=current_user.email.lower(),
                role='teacher',
            ).first()
            if not membership and not is_admin_user(current_user):
                return jsonify({'error': 'No tenés permiso para asignar una tarea a este grado'}), 403
        s.grade_id = new_grade_id
    if 'stages' in data:
        stages_data = data['stages']
        if not isinstance(stages_data, list) or not stages_data:
            return jsonify({'error': 'Se necesita al menos una etapa'}), 400
        cleaned = [{
            'id': stage.get('id'),
            'instructions': str(stage.get('instructions', '') or '').strip(),
            'custom_prompt_id': stage.get('custom_prompt_id') or None,
        } for stage in stages_data]
        kept_ids = []
        for index, stage in enumerate(cleaned, start=1):
            existing = None
            if stage['id']:
                existing = SessionStage.query.filter_by(id=stage['id'], session_id=s.id).first()
            if existing:
                existing.position = index
                existing.instructions = stage['instructions']
                existing.custom_prompt_id = stage['custom_prompt_id']
                kept_ids.append(existing.id)
            else:
                new_stage = SessionStage(
                    session_id=s.id,
                    position=index,
                    instructions=stage['instructions'],
                    custom_prompt_id=stage['custom_prompt_id'],
                )
                db.session.add(new_stage)
                db.session.flush()
                kept_ids.append(new_stage.id)
        # Delete stages omitted from the payload
        SessionStage.query.filter(
            SessionStage.session_id == s.id,
            ~SessionStage.id.in_(kept_ids)
        ).delete(synchronize_session=False)
        # Participants pointing at a deleted stage fall back to the first one
        SessionParticipant.query.filter(
            SessionParticipant.session_id == s.id,
            SessionParticipant.current_stage_id.isnot(None),
            ~SessionParticipant.current_stage_id.in_(kept_ids)
        ).update({SessionParticipant.current_stage_id: None}, synchronize_session=False)
        # Keep denormalized fields in sync with stage 1
        s.instructions = cleaned[0]['instructions']
        s.custom_prompt_id = cleaned[0]['custom_prompt_id']
    db.session.commit()
    return jsonify({
        'id': s.id,
        'title': s.title,
        'instructions': s.instructions,
        'access_level': s.access_level,
        'is_active': s.is_active,
        'llm_model_name': s.llm_model_name,
        'grade_id': s.grade_id,
        'stages': _serialize_session_stages(s),
        'updated_at': s.updated_at.isoformat()
    })

@app.route('/api/sessions/<int:session_id>', methods=['DELETE'])
@login_required
def delete_session(session_id):
    error = require_teacher()
    if error:
        return error
    s = ClassroomSession.query.filter_by(id=session_id, teacher_id=current_user.id).first_or_404()
    db.session.delete(s)
    db.session.commit()
    return '', 204

@app.route('/api/sessions/<int:session_id>/queries', methods=['GET'])
@login_required
def get_session_queries(session_id):
    error = require_teacher()
    if error:
        return error
    s = ClassroomSession.query.filter_by(id=session_id, teacher_id=current_user.id).first_or_404()
    queries = SessionQuery.query.filter_by(session_id=s.id).order_by(SessionQuery.created_at.desc()).all()
    result = []
    for q in queries:
        participant_name = 'Anónimo'
        if q.participant_id:
            participant = SessionParticipant.query.get(q.participant_id)
            if participant:
                if participant.user_id and participant.user:
                    participant_name = participant.user.name
                elif participant.display_name:
                    participant_name = participant.display_name
        result.append({
            'id': q.id,
            'participant_id': q.participant_id,
            'query_text': q.query_text,
            'response_text': q.response_text,
            'participant_name': participant_name,
            'stage_id': q.stage_id,
            'stage_position': q.stage.position if q.stage else None,
            'created_at': q.created_at.isoformat()
        })
    return jsonify({'queries': result})

@app.route('/api/sessions/join', methods=['POST'])
def join_session():
    data = request.get_json()
    code = data.get('access_code', '').strip().upper()
    display_name = data.get('display_name', '').strip() or None
    if not code:
        return jsonify({'error': 'Access code is required'}), 400
    s = ClassroomSession.query.filter_by(access_code=code, is_active=True).first()
    if not s:
        return jsonify({'error': 'Invalid or inactive session code'}), 404

    is_registered_user = current_user.is_authenticated

    if s.access_level == 'registered' and not is_registered_user:
        return jsonify({'error': 'Esta tarea requiere iniciar sesión'}), 401

    token = str(uuid.uuid4())
    participant = SessionParticipant(
        session_id=s.id,
        token=token
    )
    # En sesiones para invitados la identidad es siempre el nombre ingresado,
    # aunque el navegador tenga una sesión de login activa.
    treat_as_guest = s.access_level == 'guests' or not is_registered_user
    if treat_as_guest:
        if not display_name:
            guest_count = SessionParticipant.query.filter_by(session_id=s.id).count()
            display_name = f'Invitado {guest_count + 1}'
        participant.display_name = display_name
    else:
        participant.user_id = current_user.id
        participant.display_name = current_user.name
    first_stage = SessionStage.query.filter_by(session_id=s.id).order_by(SessionStage.position).first()
    if first_stage:
        participant.current_stage_id = first_stage.id
    db.session.add(participant)
    db.session.commit()
    prompt = None
    if s.custom_prompt_id:
        p = CustomPrompt.query.get(s.custom_prompt_id)
        if p:
            prompt = {'id': p.id, 'name': p.name, 'content': p.content}
    return jsonify({
        'session': {
            'id': s.id,
            'title': s.title,
            'instructions': s.instructions,
            'access_level': s.access_level,
            'llm_model_name': s.llm_model_name,
            'prompt': prompt,
            'stages': _serialize_session_stages(s),
            'classroom_linked': bool(s.classroom_coursework_id)
        },
        'participant_token': token,
        'participant': {
            'id': participant.id,
            'display_name': participant.display_name,
            'current_stage_id': participant.current_stage_id,
            'submitted_at': participant.submitted_at.isoformat() if participant.submitted_at else None,
            'submission_url': participant.submission_url
        }
    })

@app.route('/api/sessions/<int:session_id>/participant/me', methods=['GET'])
def get_participant_me(session_id):
    token = request.headers.get('X-Participant-Token', '')
    participant = SessionParticipant.query.filter_by(token=token, session_id=session_id).first() if token else None
    if not participant:
        return jsonify({'error': 'Invalid participant token'}), 401
    display_name = participant.display_name
    if not display_name and participant.user:
        display_name = participant.user.name
    return jsonify({
        'id': participant.id,
        'display_name': display_name,
        'current_stage_id': participant.current_stage_id,
        'submitted_at': participant.submitted_at.isoformat() if participant.submitted_at else None,
        'submission_url': participant.submission_url
    })

@app.route('/api/sessions/<int:session_id>/participant/stage', methods=['POST'])
def set_participant_stage(session_id):
    token = request.headers.get('X-Participant-Token', '')
    participant = SessionParticipant.query.filter_by(token=token, session_id=session_id).first() if token else None
    if not participant:
        return jsonify({'error': 'Invalid participant token'}), 401
    data = request.get_json() or {}
    stage = SessionStage.query.filter_by(id=data.get('stage_id'), session_id=session_id).first()
    if not stage:
        return jsonify({'error': 'Invalid stage'}), 400
    participant.current_stage_id = stage.id
    db.session.commit()
    return jsonify({'id': participant.id, 'current_stage_id': participant.current_stage_id})

@app.route('/api/sessions/<int:session_id>/participant/queries', methods=['GET'])
def get_participant_queries(session_id):
    token = request.headers.get('X-Participant-Token', '')
    participant = SessionParticipant.query.filter_by(token=token, session_id=session_id).first() if token else None
    if not participant:
        return jsonify({'error': 'Invalid participant token'}), 401
    queries = (SessionQuery.query
               .filter_by(participant_id=participant.id, session_id=session_id)
               .order_by(SessionQuery.created_at.asc())
               .all())
    return jsonify({
        'queries': [{
            'id': q.id,
            'query_text': q.query_text,
            'response_text': q.response_text,
            'stage_id': q.stage_id,
            'stage_position': q.stage.position if q.stage else None,
            'created_at': q.created_at.isoformat() if q.created_at else None,
        } for q in queries]
    })

@app.route('/api/sessions/<int:session_id>/link-classroom', methods=['POST'])
@login_required
def link_session_classroom(session_id):
    """Link a session to a new Classroom coursework so students can submit to it."""
    error = require_teacher()
    if error:
        return error
    s = ClassroomSession.query.filter_by(id=session_id, teacher_id=current_user.id).first_or_404()
    if s.classroom_coursework_id:
        return jsonify({'error': 'La tarea ya está vinculada a Classroom'}), 400
    data = request.get_json() or {}
    course_id = data.get('course_id')
    if not course_id:
        return jsonify({'error': 'course_id is required'}), 400
    title = (data.get('title') or s.title).strip()
    description = (data.get('description') or s.instructions or '').strip()

    creds = get_credentials_for_user(current_user)
    if not creds:
        return jsonify({'error': 'google_auth_required', 'message': 'Se requiere autorización de Google Classroom'}), 401
    try:
        refresh_credentials(creds)
    except Exception as e:
        app.logger.exception('Failed to refresh Google credentials')
        return jsonify({'error': 'google_auth_required', 'message': str(e)}), 401
    try:
        coursework = create_coursework(creds, course_id, title, description)
    except Exception as e:
        app.logger.exception('Failed to create Classroom coursework')
        return jsonify({'error': f'No se pudo crear la actividad en Classroom: {e}'}), 500

    s.classroom_course_id = str(course_id)
    s.classroom_coursework_id = str(coursework.get('id'))
    s.classroom_coursework_url = coursework.get('alternateLink')
    db.session.commit()
    return jsonify({
        'success': True,
        'classroom_course_id': s.classroom_course_id,
        'classroom_coursework_id': s.classroom_coursework_id,
        'classroom_coursework_url': s.classroom_coursework_url,
    })

@app.route('/api/sessions/<int:session_id>/submit', methods=['POST'])
@login_required
def submit_session_work(session_id):
    """Student submits their text: a doc is created in THEIR Drive, attached to
    their own Classroom submission and turned in."""
    s = ClassroomSession.query.get_or_404(session_id)
    if not s.classroom_coursework_id:
        return jsonify({'error': 'Esta tarea no está vinculada a Classroom'}), 400
    token = request.headers.get('X-Participant-Token', '')
    participant = SessionParticipant.query.filter_by(token=token, session_id=session_id).first() if token else None
    if not participant:
        return jsonify({'error': 'Invalid participant token'}), 401
    data = request.get_json() or {}
    text = (data.get('text') or '').strip()
    if not text:
        return jsonify({'error': 'No hay texto para entregar'}), 400

    creds = get_credentials_for_user(current_user)
    if not creds:
        return jsonify({'error': 'google_auth_required', 'message': 'Necesitás autorizar tu cuenta de Google para entregar'}), 401
    try:
        refresh_credentials(creds)
    except Exception as e:
        app.logger.exception('Failed to refresh Google credentials')
        return jsonify({'error': 'google_auth_required', 'message': str(e)}), 401

    display_name = participant.display_name or current_user.name
    stages = SessionStage.query.filter_by(session_id=s.id).order_by(SessionStage.position).all()
    content_parts = [{'text': s.title, 'heading': True}]
    if stages:
        for stage in stages:
            if stage.instructions:
                content_parts.append({'text': f"Consigna (etapa {stage.position}): {stage.instructions}"})
    elif s.instructions:
        content_parts.append({'text': f"Consigna: {s.instructions}"})
    content_parts.append({'text': ''})
    content_parts.append({'text': text})

    try:
        doc = create_google_doc(creds, f"{s.title} - {display_name}", content_parts, share_anyone=False)
        submissions = list_my_submissions(creds, s.classroom_course_id, s.classroom_coursework_id)
        if not submissions:
            return jsonify({'error': 'No encontramos una entrega tuya en Classroom. ¿Estás inscripto en el curso?'}), 400
        submission_id = submissions[0]['id']
        add_submission_drive_attachment(
            creds, s.classroom_course_id, s.classroom_coursework_id, submission_id, doc['id'], doc['title']
        )
        turn_in_submission(creds, s.classroom_course_id, s.classroom_coursework_id, submission_id)
    except HttpError as e:
        app.logger.exception('Classroom submit failed')
        if getattr(e, 'resp', None) is not None and e.resp.status in (401, 403):
            return jsonify({'error': 'google_auth_required', 'message': 'Necesitás volver a autorizar tu cuenta de Google con los nuevos permisos'}), 401
        return jsonify({'error': f'Error de Classroom: {e}'}), 500
    except Exception as e:
        app.logger.exception('Classroom submit failed')
        return jsonify({'error': f'No se pudo entregar: {e}'}), 500

    participant.submitted_at = datetime.utcnow()
    participant.submission_url = doc['url']
    db.session.commit()
    return jsonify({
        'success': True,
        'submitted_at': participant.submitted_at.isoformat(),
        'submission_url': doc['url'],
    })

@app.route('/api/sessions/by-code/<code>', methods=['GET'])
def get_session_by_code(code):
    s = ClassroomSession.query.filter_by(access_code=code.upper(), is_active=True).first()
    if not s:
        return jsonify({'error': 'Session not found'}), 404
    prompt = None
    if s.custom_prompt_id:
        p = CustomPrompt.query.get(s.custom_prompt_id)
        if p:
            prompt = {'id': p.id, 'name': p.name, 'content': p.content}
    return jsonify({
        'id': s.id,
        'title': s.title,
        'instructions': s.instructions,
        'access_level': s.access_level,
        'llm_model_name': s.llm_model_name,
        'prompt': prompt,
        'stages': _serialize_session_stages(s),
        'classroom_linked': bool(s.classroom_coursework_id)
    })

@app.route('/api/sessions/<int:session_id>/query', methods=['POST'])
def session_query(session_id):
    data = request.get_json()
    text = data.get('text', '').strip()
    token = request.headers.get('X-Participant-Token', '')
    if not text:
        return jsonify({'error': 'Text is required'}), 400
    if not token:
        return jsonify({'error': 'Participant token is required'}), 401
    participant = SessionParticipant.query.filter_by(token=token, session_id=session_id).first()
    if not participant:
        return jsonify({'error': 'Invalid participant token'}), 401
    s = ClassroomSession.query.get(session_id)
    if not s or not s.is_active:
        return jsonify({'error': 'Session not found or inactive'}), 404
    stage = None
    if participant.current_stage_id:
        stage = SessionStage.query.filter_by(id=participant.current_stage_id, session_id=s.id).first()
    if not stage:
        stage = SessionStage.query.filter_by(session_id=s.id).order_by(SessionStage.position).first()
    customprompt = None
    if stage and stage.custom_prompt_id:
        customprompt = CustomPrompt.query.get(stage.custom_prompt_id)
    elif s.custom_prompt_id:
        customprompt = CustomPrompt.query.get(s.custom_prompt_id)
    customprompt_content = customprompt.content if customprompt else "No custom prompt selected"
    openrouter_api_key = os.getenv('OPENROUTER_API_KEY')
    headers = {
        "Authorization": f"Bearer {openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.getenv('FRONTEND_URL', 'http://127.0.0.1:3000'),
        "X-Title": "Caliope Markdown Editor"
    }
    payload = {
        "model": s.llm_model_name,
        "messages": [
            {"role": "system", "content": "Eres un generador de preguntas. Generas exactamente 3 preguntas. No incluyas nada más que las preguntas separadas por un salto de linea, sin explicaciones ni contenido adicional. A continuación recibirás instrucciones sobre el rol que debes adoptar para hacer las preguntas."},
            {"role": "system", "content": customprompt_content},
            {"role": "user", "content": text}
        ]
    }
    try:
        response = requests.post("https://openrouter.ai/api/v1/chat/completions",
                                headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        response_data = response.json()
        message = response_data['choices'][0]['message']['content']
        generation_id = response_data.get('id')
        query_record = SessionQuery(
            session_id=s.id,
            participant_id=participant.id,
            stage_id=stage.id if stage else None,
            query_text=text,
            response_text=message
        )
        db.session.add(query_record)
        db.session.commit()

        # Log OpenRouter usage
        try:
            create_usage_log(
                user_id=participant.user_id,
                query_id=None,
                session_query_id=query_record.id,
                session_participant_id=participant.id,
                model_name=s.llm_model_name or "unknown",
                generation_id=generation_id,
                response_data=response_data,
            )
        except Exception as e:
            logging.warning(f"Failed to log OpenRouter usage for session query: {e}")

        return jsonify({"message": message})
    except requests.exceptions.RequestException as e:
        error_details = {
            "error": str(e),
            "status_code": e.response.status_code if hasattr(e, 'response') else None,
            "response_text": e.response.text if hasattr(e, 'response') else None
        }
        return jsonify(error_details), 500

@app.route('/api/classroom/courses', methods=['GET'])
@login_required
def classroom_courses():
    if not current_user.can_create_sessions and not is_admin_user(current_user):
        return jsonify({'error': 'Teacher access required'}), 403
    creds = get_credentials_for_user(current_user)
    if not creds:
        return jsonify({'error': 'google_auth_required', 'message': 'Se requiere autorización de Google Classroom'}), 401
    try:
        refresh_credentials(creds)
        courses = list_teacher_courses(creds)
        return jsonify({'courses': [{'id': c['id'], 'name': c.get('name', ''), 'section': c.get('section', '')} for c in courses]})
    except Exception as e:
        app.logger.exception('Failed to list Google Classroom courses')
        return jsonify({'error': str(e)}), 500


@app.route('/api/classroom/courses/<course_id>/coursework', methods=['GET'])
@login_required
def classroom_coursework(course_id):
    if not current_user.can_create_sessions and not is_admin_user(current_user):
        return jsonify({'error': 'Teacher access required'}), 403
    creds = get_credentials_for_user(current_user)
    if not creds:
        return jsonify({'error': 'google_auth_required', 'message': 'Se requiere autorización de Google Classroom'}), 401
    try:
        refresh_credentials(creds)
        items = list_coursework(creds, course_id)
        return jsonify({
            'coursework': [
                {
                    'id': item['id'],
                    'title': item.get('title', ''),
                    'state': item.get('state', ''),
                    'work_type': item.get('workType', ''),
                }
                for item in items
            ]
        })
    except Exception as e:
        app.logger.exception('Failed to list Google Classroom coursework')
        return jsonify({'error': str(e)}), 500


def _build_session_export_materials(creds, session_obj, session_id):
    """Create a Google Doc per participant and return export metadata."""
    participants = (
        SessionParticipant.query
        .filter_by(session_id=session_id)
        .order_by(SessionParticipant.display_name)
        .all()
    )

    exported = []
    materials = []
    for participant in participants:
        queries = SessionQuery.query.filter_by(participant_id=participant.id).order_by(SessionQuery.created_at).all()
        if not queries:
            continue

        participant_name = participant.display_name or (participant.user.name if participant.user else 'Anónimo')
        title = f"{session_obj.title} - {participant_name}"

        content_parts = [
            {'text': session_obj.title, 'heading': True},
            {'text': f"Alumno: {participant_name}", 'heading': False},
        ]
        if session_obj.instructions:
            content_parts.append({'text': 'Consigna', 'heading': True})
            content_parts.append({'text': session_obj.instructions, 'heading': False})

        content_parts.append({'text': 'Interacciones', 'heading': True})
        for idx, q in enumerate(queries, start=1):
            content_parts.append({'text': f"Interacción {idx}", 'heading': True})
            content_parts.append({'text': f"Texto del alumno:\n{q.query_text}", 'heading': False})
            content_parts.append({'text': f"Respuesta de la herramienta:\n{q.response_text or '(sin respuesta)'}", 'heading': False})

        doc_info = create_google_doc(creds, title, content_parts)
        exported.append({'participant_name': participant_name, 'url': doc_info['url']})
        materials.append({'id': doc_info['id'], 'title': doc_info['title']})

    return exported, materials


@app.route('/api/sessions/<int:session_id>/export-to-classroom-coursework', methods=['POST'])
@login_required
def export_session_to_classroom_coursework(session_id):
    """Create a new Google Classroom assignment with a doc per participant as materials."""
    if not current_user.can_create_sessions and not is_admin_user(current_user):
        return jsonify({'error': 'Teacher access required'}), 403

    session_obj = ClassroomSession.query.get_or_404(session_id)
    if session_obj.teacher_id != current_user.id and not is_admin_user(current_user):
        return jsonify({'error': 'Only the session teacher can export'}), 403

    data = request.get_json()
    course_id = data.get('course_id')
    title = (data.get('title') or session_obj.title or 'Textos de alumnos').strip()
    description = (data.get('description') or f"Documentos generados desde la tarea {session_obj.title}.").strip()
    if not course_id:
        return jsonify({'error': 'course_id is required'}), 400

    creds = get_credentials_for_user(current_user)
    if not creds:
        return jsonify({'error': 'google_auth_required', 'message': 'Se requiere autorización de Google Classroom'}), 401

    try:
        refresh_credentials(creds)
    except Exception as e:
        app.logger.exception('Failed to refresh Google credentials')
        return jsonify({'error': 'google_auth_required', 'message': str(e)}), 401

    exported, materials = _build_session_export_materials(creds, session_obj, session_id)
    if not materials:
        return jsonify({'error': 'No hay interacciones para exportar'}), 400

    try:
        coursework = create_coursework_with_materials(
            creds, course_id, title, description, materials
        )
    except Exception as e:
        app.logger.exception('Failed to create Classroom coursework with materials')
        return jsonify({'error': f'Los documentos se crearon pero no se pudo crear la actividad: {e}'}), 500

    return jsonify({
        'success': True,
        'exported_count': len(exported),
        'documents': exported,
        'coursework_id': coursework.get('id'),
        'coursework_url': coursework.get('alternateLink'),
    })


@app.route('/api/sessions/<int:session_id>/export-to-classroom-materials', methods=['POST'])
@login_required
def export_session_to_classroom_materials(session_id):
    """Create a new Google Classroom CourseWorkMaterial with a doc per participant."""
    if not current_user.can_create_sessions and not is_admin_user(current_user):
        return jsonify({'error': 'Teacher access required'}), 403

    session_obj = ClassroomSession.query.get_or_404(session_id)
    if session_obj.teacher_id != current_user.id and not is_admin_user(current_user):
        return jsonify({'error': 'Only the session teacher can export'}), 403

    data = request.get_json()
    course_id = data.get('course_id')
    title = (data.get('title') or session_obj.title or 'Textos de alumnos').strip()
    description = (data.get('description') or f"Documentos generados desde la tarea {session_obj.title}.").strip()
    if not course_id:
        return jsonify({'error': 'course_id is required'}), 400

    creds = get_credentials_for_user(current_user)
    if not creds:
        return jsonify({'error': 'google_auth_required', 'message': 'Se requiere autorización de Google Classroom'}), 401

    try:
        refresh_credentials(creds)
    except Exception as e:
        app.logger.exception('Failed to refresh Google credentials')
        return jsonify({'error': 'google_auth_required', 'message': str(e)}), 401

    exported, materials = _build_session_export_materials(creds, session_obj, session_id)
    if not materials:
        return jsonify({'error': 'No hay interacciones para exportar'}), 400

    try:
        material = create_coursework_material(
            creds, course_id, title, description, materials
        )
    except Exception as e:
        app.logger.exception('Failed to create Classroom coursework material')
        return jsonify({'error': f'Los documentos se crearon pero no se pudo crear el material: {e}'}), 500

    return jsonify({
        'success': True,
        'exported_count': len(exported),
        'documents': exported,
        'material_id': material.get('id'),
        'material_url': material.get('alternateLink'),
    })


@app.route('/api/grades/my-grades', methods=['GET'])
@login_required
def my_grades():
    """List grades where the current user is a teacher."""
    if not current_user.can_create_sessions and not is_admin_user(current_user):
        return jsonify({'error': 'Teacher access required'}), 403
    grades = (
        Grade.query
        .join(UserGrade)
        .filter(
            db.func.lower(UserGrade.email) == current_user.email.lower(),
            UserGrade.role == 'teacher',
        )
        .order_by(Grade.name)
        .all()
    )
    return jsonify({
        'grades': [{
            'id': g.id,
            'name': g.name,
            'institution_id': g.institution_id,
            'institution_name': g.institution.name,
        } for g in grades]
    })


@app.route('/api/sessions/student', methods=['GET'])
@login_required
def list_student_sessions():
    """List active sessions assigned to grades where the user is a student."""
    student_grade_ids = (
        db.session.query(UserGrade.grade_id)
        .filter(
            db.func.lower(UserGrade.email) == current_user.email.lower(),
            UserGrade.role == 'student',
        )
        .subquery()
    )
    sessions = (
        ClassroomSession.query
        .filter(
            ClassroomSession.grade_id.in_(student_grade_ids),
            ClassroomSession.is_active == True,
        )
        .order_by(ClassroomSession.created_at.desc())
        .all()
    )
    result = []
    for s in sessions:
        prompt = None
        if s.custom_prompt_id:
            p = CustomPrompt.query.get(s.custom_prompt_id)
            if p:
                prompt = {'id': p.id, 'name': p.name}
        result.append({
            'id': s.id,
            'title': s.title,
            'instructions': s.instructions,
            'access_code': s.access_code,
            'access_level': s.access_level,
            'llm_model_name': s.llm_model_name,
            'prompt': prompt,
            'teacher_name': s.teacher.name if s.teacher else None,
            'created_at': s.created_at.isoformat(),
        })
    return jsonify({'sessions': result})


@app.route('/api/admin/users/<int:user_id>/teacher-status', methods=['PUT'])
@login_required
def update_teacher_status(user_id):
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    data = request.get_json()
    user = User.query.get_or_404(user_id)
    user.can_create_sessions = bool(data.get('can_create_sessions', False))
    db.session.commit()
    return jsonify({
        'id': user.id,
        'username': user.username,
        'can_create_sessions': user.can_create_sessions
    })

# Available models endpoints

@app.route('/api/models', methods=['GET'])
def list_active_models():
    models = AvailableModel.query.filter_by(is_active=True).order_by(AvailableModel.label).all()
    return jsonify({
        'models': [{
            'id': m.id,
            'slug': m.slug,
            'label': m.label,
        } for m in models]
    })

@app.route('/api/admin/models', methods=['GET'])
@login_required
def admin_list_models():
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    models = AvailableModel.query.order_by(AvailableModel.label).all()
    return jsonify({
        'models': [{
            'id': m.id,
            'slug': m.slug,
            'label': m.label,
            'is_active': m.is_active,
            'updated_at': m.updated_at.isoformat()
        } for m in models]
    })

@app.route('/api/admin/models', methods=['POST'])
@login_required
def admin_create_model():
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    data = request.get_json()
    slug = data.get('slug', '').strip()
    label = data.get('label', '').strip()
    if not slug or not label:
        return jsonify({'error': 'Slug and label are required'}), 400
    if AvailableModel.query.filter_by(slug=slug).first():
        return jsonify({'error': 'Model slug already exists'}), 409
    model = AvailableModel(slug=slug, label=label, is_active=True)
    db.session.add(model)
    db.session.commit()
    return jsonify({
        'id': model.id,
        'slug': model.slug,
        'label': model.label,
        'is_active': model.is_active,
    }), 201

@app.route('/api/admin/models/<int:model_id>', methods=['PUT'])
@login_required
def admin_update_model(model_id):
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    model = AvailableModel.query.get_or_404(model_id)
    data = request.get_json()
    model.slug = data.get('slug', model.slug).strip()
    model.label = data.get('label', model.label).strip()
    if 'is_active' in data:
        model.is_active = bool(data['is_active'])
    db.session.commit()
    return jsonify({
        'id': model.id,
        'slug': model.slug,
        'label': model.label,
        'is_active': model.is_active,
    })

@app.route('/api/admin/models/<int:model_id>', methods=['DELETE'])
@login_required
def admin_delete_model(model_id):
    if not is_admin_user(current_user):
        return jsonify({'error': 'Admin access required'}), 403
    model = AvailableModel.query.get_or_404(model_id)
    db.session.delete(model)
    db.session.commit()
    return '', 204

# Invitation link endpoints
@app.route('/api/invitations', methods=['GET'])
@login_required
def get_invitations():
    if not current_user.can_create_invites:
        return jsonify({'error': 'No tenés permiso para ver invitaciones.'}), 403

    links = InvitationLink.query.filter_by(created_by_id=current_user.id).order_by(InvitationLink.created_at.desc()).all()
    return jsonify({
        'invitations': [{
            'id': link.id,
            'token': link.token,
            'created_at': link.created_at.isoformat() if link.created_at else None,
            'expires_at': link.expires_at.isoformat() if link.expires_at else None,
            'used': link.used_by_id is not None,
            'used_at': link.used_at.isoformat() if link.used_at else None,
            'used_by_email': link.used_by.email if link.used_by else None,
        } for link in links]
    })

@app.route('/api/invitations', methods=['POST'])
@login_required
def create_invitation():
    if not current_user.can_create_invites:
        return jsonify({'error': 'No tenés permiso para crear invitaciones.'}), 403

    token = secrets.token_urlsafe(32)
    link = InvitationLink(
        token=token,
        created_by_id=current_user.id,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.session.add(link)
    db.session.commit()

    frontend_url = os.getenv('FRONTEND_URL', '')
    invite_url = f"{frontend_url.rstrip('/')}/invite/{token}"

    return jsonify({
        'id': link.id,
        'token': link.token,
        'invite_url': invite_url,
        'expires_at': link.expires_at.isoformat()
    }), 201

@app.route('/api/invitations/<token>', methods=['GET'])
def check_invitation(token):
    link = InvitationLink.query.filter_by(token=token).first()
    if not link:
        return jsonify({'error': 'Link de invitación no encontrado.'}), 404

    if link.used_by_id is not None:
        return jsonify({'error': 'Este link de invitación ya fue utilizado.'}), 410

    if link.expires_at and datetime.utcnow() > link.expires_at:
        return jsonify({'error': 'Este link de invitación ha expirado.'}), 410

    return jsonify({'valid': True})

@app.route('/api/invitations/<token>/register', methods=['POST'])
def register_with_invitation(token):
    link = InvitationLink.query.filter_by(token=token).first()
    if not link:
        return jsonify({'error': 'Link de invitación no encontrado.'}), 404

    if link.used_by_id is not None:
        return jsonify({'error': 'Este link de invitación ya fue utilizado.'}), 410

    if link.expires_at and datetime.utcnow() > link.expires_at:
        return jsonify({'error': 'Este link de invitación ha expirado.'}), 410

    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    name = data.get('name')
    password = data.get('password')

    if not username or not email or not name or not password:
        return jsonify({'error': 'Todos los campos son obligatorios.'}), 400

    if len(password) < 6:
        return jsonify({'error': 'La contraseña debe tener al menos 6 caracteres.'}), 400

    existing = User.query.filter((User.username == username) | (User.email == email)).first()
    if existing:
        return jsonify({'error': 'El usuario o email ya está registrado.'}), 409

    try:
        user = User(
            username=username,
            email=email,
            name=name,
            trial_expires_at=datetime.utcnow() + timedelta(days=15),
            is_disabled=False
        )
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        link.used_by_id = user.id
        link.used_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'message': 'Cuenta creada exitosamente. Iniciá sesión para comenzar.',
            'user_id': user.id
        }), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Error al crear el usuario. Intentá con otro nombre o email.'}), 500

# Global error handler for 500 errors
@app.errorhandler(500)
def handle_500_error(e):
    app.logger.error(f"[500 Error] {str(e)}")
    return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

# Global error handler for 404 errors
@app.errorhandler(404)
def handle_404_error(e):
    return jsonify({'error': 'Not found'}), 404

# Teardown function to remove database session after each request
@app.teardown_appcontext
def shutdown_session(exception=None):
    db.session.remove()

if __name__ == '__main__':
    with app.app_context():
        init_db()
    port = int(os.environ.get('BACKEND_PORT', '5000'))
    print(f"[Flask] Starting server on 0.0.0.0:{port}", flush=True)
    app.run(debug=False, host='0.0.0.0', port=port)
