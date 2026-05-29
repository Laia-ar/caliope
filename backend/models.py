from datetime import datetime
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

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    documents = db.relationship('Document', backref='author', lazy=True)
    prompts = db.relationship('CustomPrompt', backref='author', lazy=True)
    sessions = db.relationship('ClassroomSession', back_populates='teacher', lazy=True)

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
    display_name = db.Column(db.String(100), nullable=True)
    token = db.Column(db.String(36), unique=True, nullable=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)

    queries = db.relationship('SessionQuery', backref='participant', lazy=True)

class SessionQuery(db.Model):
    __tablename__ = 'session_queries'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('classroom_sessions.id'), nullable=False)
    participant_id = db.Column(db.Integer, db.ForeignKey('session_participants.id'), nullable=True)
    query_text = db.Column(db.Text, nullable=False)
    response_text = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

def init_db():
    db.create_all()
