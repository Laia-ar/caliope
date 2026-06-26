from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db
from flask_login import UserMixin

class User(db.Model, UserMixin):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    google_id = db.Column(db.String(100), unique=True, nullable=True)
    username = db.Column(db.String(100), unique=True, nullable=True)
    email = db.Column(db.String(100), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    password_hash = db.Column(db.String(128))
    can_create_sessions = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    can_create_invites = db.Column(db.Boolean, default=False)
    trial_expires_at = db.Column(db.DateTime, nullable=True)
    is_disabled = db.Column(db.Boolean, default=False)
    is_admin = db.Column(db.Boolean, default=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    documents = db.relationship('Document', backref='author', lazy=True)
    prompts = db.relationship('CustomPrompt', backref='author', lazy=True)
    sessions = db.relationship('ClassroomSession', back_populates='teacher', lazy=True)
    invitation_links = db.relationship('InvitationLink', foreign_keys='InvitationLink.created_by_id', backref='creator', lazy=True)

class InvitationLink(db.Model):
    __tablename__ = 'invitation_links'

    id = db.Column(db.Integer, primary_key=True)
    token = db.Column(db.String(64), unique=True, nullable=False, index=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    used_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    used_at = db.Column(db.DateTime, nullable=True)
    expires_at = db.Column(db.DateTime, default=lambda: datetime.utcnow() + timedelta(days=7))

    used_by = db.relationship('User', foreign_keys=[used_by_id], backref='used_invitation', uselist=False)

class Document(db.Model):
    __tablename__ = 'documents'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False, default='Untitled Document')
    content = db.Column(db.Text, nullable=False, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CustomPrompt(db.Model):
    __tablename__ = 'custom_prompts'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    public = db.Column(db.Boolean, default=False)

class Query(db.Model):
    __tablename__ = 'queries'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=True)
    query_text = db.Column(db.Text, nullable=False)
    custom_prompt_id = db.Column(db.Integer, db.ForeignKey('custom_prompts.id'), nullable=True)
    llm_model_name = db.Column(db.String(100), nullable=False)
    response_text = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class ClassroomSession(db.Model):
    __tablename__ = 'classroom_sessions'

    id = db.Column(db.Integer, primary_key=True)
    teacher_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    instructions = db.Column(db.Text, nullable=False, default='')
    custom_prompt_id = db.Column(db.Integer, db.ForeignKey('custom_prompts.id'), nullable=True)
    llm_model_name = db.Column(db.String(100), nullable=False)
    access_code = db.Column(db.String(10), unique=True, nullable=False, index=True)
    access_level = db.Column(db.String(20), nullable=False, default='registered')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    teacher = db.relationship('User', back_populates='sessions')
    prompt = db.relationship('CustomPrompt', lazy=True)
    participants = db.relationship('SessionParticipant', backref='session', lazy=True, cascade='all, delete-orphan')
    queries = db.relationship('SessionQuery', backref='session', lazy=True, cascade='all, delete-orphan')

class SessionParticipant(db.Model):
    __tablename__ = 'session_participants'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('classroom_sessions.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    display_name = db.Column(db.String(100), nullable=True)
    token = db.Column(db.String(36), unique=True, nullable=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', lazy=True)
    queries = db.relationship('SessionQuery', backref='participant', lazy=True)

class SessionQuery(db.Model):
    __tablename__ = 'session_queries'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('classroom_sessions.id'), nullable=False)
    participant_id = db.Column(db.Integer, db.ForeignKey('session_participants.id'), nullable=True)
    query_text = db.Column(db.Text, nullable=False)
    response_text = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class UsageLog(db.Model):
    __tablename__ = 'usage_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    query_id = db.Column(db.Integer, db.ForeignKey('queries.id'), nullable=True)
    session_query_id = db.Column(db.Integer, db.ForeignKey('session_queries.id'), nullable=True)
    session_participant_id = db.Column(db.Integer, db.ForeignKey('session_participants.id'), nullable=True)
    generation_id = db.Column(db.String(100), nullable=True, index=True)
    model_name = db.Column(db.String(200), nullable=False)
    prompt_tokens = db.Column(db.Integer, nullable=False, default=0)
    completion_tokens = db.Column(db.Integer, nullable=False, default=0)
    total_tokens = db.Column(db.Integer, nullable=False, default=0)
    cost_usd = db.Column(db.Numeric(20, 10), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', lazy=True)

class OpenRouterBalanceSnapshot(db.Model):
    __tablename__ = 'openrouter_balance_snapshots'

    id = db.Column(db.Integer, primary_key=True)
    total_credits = db.Column(db.Numeric(20, 10), nullable=False)
    total_usage = db.Column(db.Numeric(20, 10), nullable=False)
    balance_usd = db.Column(db.Numeric(20, 10), nullable=False)
    checked_at = db.Column(db.DateTime, default=datetime.utcnow)

class AvailableModel(db.Model):
    __tablename__ = 'available_models'

    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(200), unique=True, nullable=False)
    label = db.Column(db.String(200), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

def init_db():
    db.create_all()
