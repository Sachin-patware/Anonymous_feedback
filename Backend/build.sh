#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt

DATABASE_URL=sqlite:///db.sqlite3 python manage.py collectstatic --no-input
