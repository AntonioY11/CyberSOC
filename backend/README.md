# CyberSOC Backend

This folder contains the Django REST backend for CyberSOC. It exposes authentication, incident management, threat actor management, system assets, and audit/history endpoints for the Angular frontend.

## Tech Stack

- Django 3.2
- Django REST Framework
- JWT authentication via `djangorestframework-simplejwt`
- MongoDB through Djongo
- Django Filter
- CORS headers for the Angular frontend

## Main Features

- JWT login and refresh token flow
- Custom user roles: `ADMIN` and `ANALYST`
- Incident lifecycle management with assignment, resolution, reopen, and soft delete behavior
- Threat actor management and incident-to-threat-actor linking
- Evidence uploads for incident images and forensic reports
- Audit logging and incident history logging

## Project Layout

- `cybersoc/settings.py` - Django settings, database configuration, JWT config, media config, and CORS setup
- `cybersoc/urls.py` - Project-level routes for admin, token auth, and the API
- `soc/models.py` - Core data models
- `soc/serializers.py` - Request validation and response shaping
- `soc/views.py` - API endpoints and custom workflow actions
- `soc/permissions.py` - Role-based access rules
- `soc/signals.py` - Automatic incident log generation
- `soc/middleware.py` - Tracks the current user for logging
- `soc/management/commands/patch_incident_soft_delete.py` - Backfill command for soft-delete data

## Requirements

- Python environment with the packages in `requirements.txt`
- MongoDB Atlas connection string
- A `.env` file in this directory

## Environment Variables

Create a `.env` file in `backend/` with at least:

```env
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
MONGODB_URI=mongodb+srv://user:pass@cluster.example.mongodb.net/?retryWrites=true&w=majority
MONGODB_NAME=cybersoc
```

If `MONGODB_URI` is missing, the project will not start.

## Setup

From the `backend/` directory:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
```

## Run the Server

```bash
python manage.py runserver
```

The API will usually be available at `http://127.0.0.1:8000/`.

## Authentication Flow

The backend supports JWT auth.

- `POST /api/token/` - obtain access and refresh tokens
- `POST /api/token/refresh/` - refresh the access token
- `POST /api/auth/login/` - application login endpoint used by the frontend
- `PATCH /api/auth/change-password/` - change the current password

## Core API Endpoints

- `GET /api/users/`
- `GET /api/systems/`
- `GET /api/threat-actors/`
- `GET /api/incidents/`
- `GET /api/incident-logs/`
- `GET /api/audit-logs/`

Admin endpoints also include:

- `POST /api/admin/invite-user/`
- `POST /api/admin/add-asset/`
- `GET /api/admin/users/`
- `GET /api/admin/threat-actors/`

## Incident Workflow Notes

- Incidents start in `NEW`
- Severity is derived from the linked system criticality when an incident is created
- Incidents can be claimed or assigned to an analyst
- Resolved incidents are frozen until reopened by an admin
- Non-resolved incidents can be soft-deleted or reassigned
- Evidence and report uploads are stored under `media/incidents/`

## Data and Logging Notes

- `IncidentLog` stores the incident timeline
- `AuditLog` stores user/admin actions
- Incident signals automatically add log entries when incidents or threat actor links change
- Users are deactivated with `is_active = False` instead of being hard deleted
- Incidents are soft-deleted using `is_deleted = True`

## Useful Commands

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py check
python manage.py runserver
python manage.py patch_incident_soft_delete
```
