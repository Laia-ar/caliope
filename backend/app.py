from flask import Flask, redirect, url_for, request, session, jsonify, send_file
from flask_cors import CORS  # Import the CORS extension
from flask_login import LoginManager, login_user, logout_user, current_user, login_required
from werkzeug.utils import secure_filename
from werkzeug.middleware.proxy_fix import ProxyFix
import os
import json
import shutil
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from extensions import db
from models import init_db, User, Document, CustomPrompt, InvitationLink
from authlib.integrations.flask_client import OAuth
from urllib.parse import urljoin, urlparse

# Admin configuration from environment variables
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD')

def is_admin_user(username: str) -> bool:
    """Check if the given username is the admin user."""
    if not username:
        return False
    return username.lower() == ADMIN_USERNAME.lower()

def load_users_from_json():
    """Load users from users.json if it exists, otherwise return empty list."""
    users_file = Path(__file__).parent / 'users.json'
    if users_file.exists():
        with open(users_file) as f:
            return json.load(f)['users']
    
    return []

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
        'scope': 'openid email profile',
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
    return google.authorize_redirect(
        redirect_uri,
        state=session.get('_state', 'default'),
        verify=False  # Temporarily disable state verification
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
        
        db.session.commit()
        
        # Check disabled / trial expiry for OAuth users too
        if user.is_disabled:
            return "Cuenta deshabilitada. Escribinos a hola@laia.ar para seguir probando y charlando.", 403
        
        if user.trial_expires_at and datetime.utcnow() > user.trial_expires_at:
            user.is_disabled = True
            db.session.commit()
            return "Tu período de prueba de 15 días ha expirado. Escribinos a hola@laia.ar para seguir probando y charlando.", 403
        
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

@app.route('/api/check-auth', methods=['GET'])
def check_auth():
    user = current_user
    app.logger.info(f"[Auth Check] Session: {dict(session)}")
    app.logger.info(f"[Auth Check] User: {user}, Authenticated: {user.is_authenticated if hasattr(user, 'is_authenticated') else 'no attr'}")
    
    if hasattr(user, 'is_authenticated') and user.is_authenticated:
        return jsonify({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'name': user.name,
            'can_create_invites': user.can_create_invites if hasattr(user, 'can_create_invites') else False
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
    
    user_data = None
    
    # First: Check environment variable credentials
    if username == ADMIN_USERNAME and ADMIN_PASSWORD and password == ADMIN_PASSWORD:
        user_data = {
            'username': ADMIN_USERNAME,
            'password': ADMIN_PASSWORD,
            'email': f'{ADMIN_USERNAME}@app.local',
            'name': 'Administrator',
            'is_disabled': False
        }
    
    # Second: Check users.json file (if exists)
    if not user_data:
        static_users = load_users_from_json()
        user_data = next((u for u in static_users if u['username'] == username), None)
    
    user = None
    
    if user_data:
        # Validate credentials against static data
        if user_data['password'] != password:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Check if account is disabled in static data first
        if user_data.get('is_disabled', False):
            return jsonify({'error': 'Cuenta deshabilitada. Escribinos a hola@laia.ar para seguir probando y charlando. :)'}), 403
        
        # Find or create user in database
        user = User.query.filter(
            (User.username == user_data['username']) | (User.email == user_data['email'])
        ).first()
        
        if user:
            # Update existing user credentials
            user.name = user_data['name']
            user.set_password(user_data['password'])
            db.session.commit()
        else:
            try:
                user = User(
                    username=user_data['username'],
                    email=user_data['email'],
                    name=user_data['name']
                )
                user.set_password(user_data['password'])
                db.session.add(user)
                db.session.commit()
            except IntegrityError:
                db.session.rollback()
                app.logger.error(f"[Login] IntegrityError creating user {user_data['username']}")
                return jsonify({'error': 'User conflict. Please contact support.'}), 500
    else:
        # Third: Check database directly for users created via OAuth or invitations
        user = User.query.filter_by(username=username).first()
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
    
    return jsonify({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'name': user.name,
        'is_admin': is_admin_user(username)
    })

@app.route('/api/admin/dashboard', methods=['GET'])
@login_required
def admin_dashboard():
    if not is_admin_user(current_user.username):
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

@app.route('/api/admin/users', methods=['GET'])
@login_required
def admin_users():
    if not is_admin_user(current_user.username):
        return jsonify({'error': 'Admin access required'}), 403
    
    users = User.query.all()
    return jsonify({
        'users': [{
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'name': user.name,
            'is_admin': is_admin_user(user.username),
            'can_create_invites': user.can_create_invites if hasattr(user, 'can_create_invites') else False
        } for user in users]
    })

@app.route('/api/admin/users/<int:user_id>/features', methods=['PUT'])
@login_required
def admin_user_features(user_id):
    if not is_admin_user(current_user.username):
        return jsonify({'error': 'Admin access required'}), 403
    
    data = request.get_json()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if 'can_create_invites' in data:
        user.can_create_invites = bool(data['can_create_invites'])
        db.session.commit()
    
    return jsonify({
        'id': user.id,
        'username': user.username,
        'can_create_invites': user.can_create_invites
    })

@app.route('/api/admin/users/rawjson', methods=['GET'])
@login_required
def get_raw_users_json():
    if not is_admin_user(current_user.username):
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        users_file = Path(__file__).parent / 'users.json'
        with open(users_file, 'r') as f:
            content = f.read()
        return content, 200, {'Content-Type': 'application/json'}
    except Exception as e:
        return jsonify({'error': f'Failed to read users.json: {str(e)}'}), 500

@app.route('/api/admin/users/rawjson', methods=['PUT'])
@login_required
def update_raw_users_json():
    if not is_admin_user(current_user.username):
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        # Validate JSON is parseable
        json.loads(request.data)
        
        users_file = Path(__file__).parent / 'users.json'
        with open(users_file, 'w') as f:
            f.write(request.data.decode('utf-8'))
            
        return jsonify({'message': 'users.json updated successfully'})
        
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid JSON format'}), 400
    except Exception as e:
        return jsonify({'error': f'Failed to update users.json: {str(e)}'}), 500

@app.route('/api/admin/download-db', methods=['GET'])
@login_required
def download_db():
    if not is_admin_user(current_user.username):
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
    if not is_admin_user(current_user.username):
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
