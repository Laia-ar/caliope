import os
import requests
from html.parser import HTMLParser
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request


def _u16len(s: str) -> int:
    """Longitud en unidades UTF-16, que es como indexa la Docs API."""
    return len(s.encode('utf-16-le')) // 2


_BLOCK_STYLES = {'h1': 'HEADING_1', 'h2': 'HEADING_2', 'h3': 'HEADING_3'}
_BLOCK_TAGS = {'p', 'li', 'h1', 'h2', 'h3'}
_INLINE_TAGS = {
    'strong': ('bold', {'bold': True}),
    'b': ('bold', {'bold': True}),
    'em': ('italic', {'italic': True}),
    'i': ('italic', {'italic': True}),
}


class _EditorHTMLParser(HTMLParser):
    """Convierte el HTML del editor TipTap en bloques de texto con estilos
    (headings, negrita, cursiva, links, listas) para la Docs API."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks = []
        self._cur = None       # bloque en construcción
        self._inline = []      # stack de (tag, style_dict, start_char)
        self._lists = []       # stack de 'ul'/'ol'

    def _pos(self) -> int:
        return self._cur['length'] if self._cur else 0

    def _ensure_block(self):
        if self._cur is None:
            self._cur = {
                'chars': [],
                'length': 0,
                'style': 'NORMAL_TEXT',
                'list': self._lists[-1] if self._lists else None,
                'spans': [],
            }

    def _close_block(self):
        if self._cur is None:
            return
        text = ''.join(self._cur['chars'])
        if text.strip():
            self.blocks.append({
                'text': text,
                'style': self._cur['style'],
                'list': self._cur['list'],
                'spans': self._cur['spans'],
            })
        self._cur = None

    def handle_starttag(self, tag, attrs):
        if tag in ('ul', 'ol'):
            self._lists.append(tag)
        elif tag in _BLOCK_TAGS:
            self._close_block()
            self._ensure_block()
            self._cur['style'] = _BLOCK_STYLES.get(tag, 'NORMAL_TEXT')
            if tag == 'li':
                self._cur['list'] = self._lists[-1] if self._lists else 'ul'
        elif tag in _INLINE_TAGS:
            self._ensure_block()
            name, style = _INLINE_TAGS[tag]
            self._inline.append((name, style, self._pos()))
        elif tag == 'a':
            self._ensure_block()
            href = dict(attrs).get('href', '')
            self._inline.append(('link', {'link': {'url': href}}, self._pos()))
        elif tag == 'br':
            self.handle_data('\n')

    def handle_endtag(self, tag):
        if tag in ('ul', 'ol'):
            if self._lists:
                self._lists.pop()
        elif tag in _BLOCK_TAGS:
            self._close_block()
        else:
            name = 'link' if tag == 'a' else _INLINE_TAGS.get(tag, (None,))[0]
            if name:
                # Cierra el último inline abierto de ese tipo
                for i in range(len(self._inline) - 1, -1, -1):
                    if self._inline[i][0] == name:
                        _, style, start = self._inline.pop(i)
                        if self._cur and self._pos() > start:
                            self._cur['spans'].append((start, self._pos(), style))
                        break

    def handle_data(self, data):
        self._ensure_block()
        self._cur['chars'].append(data)
        self._cur['length'] += len(data)


def editor_html_to_blocks(html: str) -> list[dict]:
    """Convierte HTML del editor a bloques para create_google_doc."""
    parser = _EditorHTMLParser()
    parser.feed(html or '')
    parser.close()
    parser._close_block()
    return parser.blocks


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
    o bloques generados por editor_html_to_blocks:
      {'text': '...', 'style': 'NORMAL_TEXT'|'HEADING_1'|...,
       'list': 'ul'|'ol'|None, 'spans': [(start, end, textStyle), ...]}
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
        block_len = _u16len(text)
        requests_batch.append({
            'insertText': {
                'location': {'index': end_index},
                'text': text + '\n',
            }
        })
        style = part.get('style') or ('HEADING_2' if part.get('heading') else None)
        if style and style != 'NORMAL_TEXT':
            requests_batch.append({
                'updateParagraphStyle': {
                    'range': {
                        'startIndex': end_index,
                        'endIndex': end_index + block_len,
                    },
                    'paragraphStyle': {'namedStyleType': style},
                    'fields': 'namedStyleType',
                }
            })
        if part.get('list'):
            preset = ('NUMBERED_DECIMAL_ALPHA_ROMAN' if part['list'] == 'ol'
                      else 'BULLET_DISC_CIRCLE_SQUARE')
            requests_batch.append({
                'createParagraphBullets': {
                    'range': {
                        'startIndex': end_index,
                        'endIndex': end_index + block_len + 1,
                    },
                    'bulletPreset': preset,
                }
            })
        for span_start, span_end, text_style in part.get('spans', []):
            start = end_index + _u16len(text[:span_start])
            end = end_index + _u16len(text[:span_end])
            if end <= start:
                continue
            requests_batch.append({
                'updateTextStyle': {
                    'range': {'startIndex': start, 'endIndex': end},
                    'textStyle': text_style,
                    'fields': ','.join(text_style.keys()),
                }
            })
        end_index += block_len + 1

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
