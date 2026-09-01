import os
import requests
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request


SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.students',
    'https://www.googleapis.com/auth/classroom.coursework.me',
    'https://www.googleapis.com/auth/classroom.courseworkmaterials',
    'https://www.googleapis.com/auth/drive.file',
]


def get_credentials_for_user(user) -> Credentials | None:
    """Build Google Credentials from a user's stored refresh token."""
    if not user or not user.google_refresh_token:
        return None
    return Credentials(
        token=None,
        refresh_token=user.google_refresh_token,
        token_uri='https://oauth2.googleapis.com/token',
        client_id=os.getenv('GOOGLE_CLIENT_ID'),
        client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
        scopes=SCOPES,
    )


def refresh_credentials(creds: Credentials) -> Credentials:
    creds.refresh(Request())
    return creds


def list_teacher_courses(creds: Credentials):
    service = build('classroom', 'v1', credentials=creds)
    courses = []
    page_token = None
    while True:
        response = service.courses().list(teacherId='me', pageToken=page_token, pageSize=100).execute()
        courses.extend(response.get('courses', []))
        page_token = response.get('nextPageToken')
        if not page_token:
            break
    return courses


def list_coursework(creds: Credentials, course_id: str):
    service = build('classroom', 'v1', credentials=creds)
    items = []
    page_token = None
    while True:
        response = service.courses().courseWork().list(
            courseId=course_id, pageToken=page_token, pageSize=100
        ).execute()
        items.extend(response.get('courseWork', []))
        page_token = response.get('nextPageToken')
        if not page_token:
            break
    return items


def create_google_doc(creds: Credentials, title: str, content_parts: list[dict], share_anyone: bool = True) -> dict:
    """Create a Google Doc with the given title and append content.

    content_parts is a list of dicts like:
      {'text': '...', 'heading': True|False}
    share_anyone adds an anyone-with-the-link writer permission; disable it
    for student-owned docs (Classroom handles sharing on turn-in).
    """
    docs_service = build('docs', 'v1', credentials=creds)
    drive_service = build('drive', 'v3', credentials=creds)

    doc = docs_service.documents().create(body={'title': title}).execute()
    doc_id = doc['documentId']

    requests_batch = []
    end_index = 1  # Start of doc
    for part in content_parts:
        text = part.get('text', '')
        if not text:
            continue
        requests_batch.append({
            'insertText': {
                'location': {'index': end_index},
                'text': text + '\n',
            }
        })
        if part.get('heading'):
            requests_batch.append({
                'updateParagraphStyle': {
                    'range': {
                        'startIndex': end_index,
                        'endIndex': end_index + len(text),
                    },
                    'paragraphStyle': {'namedStyleType': 'HEADING_2'},
                    'fields': 'namedStyleType',
                }
            })
        end_index += len(text) + 1

    if requests_batch:
        docs_service.documents().batchUpdate(
            documentId=doc_id,
            body={'requests': requests_batch}
        ).execute()

    # Make it editable by anyone with the link
    if share_anyone:
        drive_service.permissions().create(
            fileId=doc_id,
            body={'type': 'anyone', 'role': 'writer'},
            fields='id'
        ).execute()

    return {
        'id': doc_id,
        'title': title,
        'url': f"https://docs.google.com/document/d/{doc_id}/edit",
    }


def _build_drive_materials(materials: list[dict]) -> list[dict]:
    """Build Classroom API material objects from Drive file metadata."""
    return [
        {
            'driveFile': {
                'driveFile': {'id': m['id'], 'title': m['title']},
                'shareMode': 'VIEW',
            }
        }
        for m in materials
    ]


def create_coursework_with_materials(
    creds: Credentials,
    course_id: str,
    title: str,
    description: str,
    materials: list[dict],
) -> dict:
    """Create a new CourseWork (assignment) with Drive files as materials."""
    service = build('classroom', 'v1', credentials=creds)
    body = {
        'title': title,
        'description': description,
        'workType': 'ASSIGNMENT',
        'state': 'PUBLISHED',
        'materials': _build_drive_materials(materials),
    }
    return service.courses().courseWork().create(
        courseId=course_id, body=body
    ).execute()


def create_coursework_material(
    creds: Credentials,
    course_id: str,
    title: str,
    description: str,
    materials: list[dict],
) -> dict:
    """Create a CourseWorkMaterial (independent material) with Drive files."""
    service = build('classroom', 'v1', credentials=creds)
    body = {
        'title': title,
        'description': description,
        'state': 'PUBLISHED',
        'materials': _build_drive_materials(materials),
    }
    return service.courses().courseWorkMaterials().create(
        courseId=course_id, body=body
    ).execute()


def create_coursework(creds: Credentials, course_id: str, title: str, description: str) -> dict:
    """Create a plain CourseWork (assignment) with no class-level materials."""
    service = build('classroom', 'v1', credentials=creds)
    body = {
        'title': title,
        'description': description,
        'workType': 'ASSIGNMENT',
        'state': 'PUBLISHED',
    }
    return service.courses().courseWork().create(
        courseId=course_id, body=body
    ).execute()


def list_my_submissions(creds: Credentials, course_id: str, coursework_id: str) -> list[dict]:
    """List the current user's submissions for a coursework (student credentials)."""
    service = build('classroom', 'v1', credentials=creds)
    response = service.courses().courseWork().studentSubmissions().list(
        courseId=course_id, courseWorkId=coursework_id, userId='me'
    ).execute()
    return response.get('studentSubmissions', [])


def add_submission_drive_attachment(
    creds: Credentials,
    course_id: str,
    coursework_id: str,
    submission_id: str,
    file_id: str,
    title: str,
) -> dict:
    """Attach a Drive file to a student's own submission."""
    service = build('classroom', 'v1', credentials=creds)
    body = {
        'addAttachments': [
            {'driveFile': {'id': file_id}}
        ]
    }
    return service.courses().courseWork().studentSubmissions().modifyAttachments(
        courseId=course_id, courseWorkId=coursework_id, id=submission_id, body=body
    ).execute()


def turn_in_submission(creds: Credentials, course_id: str, coursework_id: str, submission_id: str) -> dict:
    """Turn in a student's own submission (student credentials required)."""
    service = build('classroom', 'v1', credentials=creds)
    return service.courses().courseWork().studentSubmissions().turnIn(
        courseId=course_id, courseWorkId=coursework_id, id=submission_id, body={}
    ).execute()
