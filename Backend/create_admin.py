import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'feedbacksystem.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin', role='admin')
    print("Superuser 'admin' created successfully with password 'admin'.")
else:
    print("Superuser 'admin' already exists.")
