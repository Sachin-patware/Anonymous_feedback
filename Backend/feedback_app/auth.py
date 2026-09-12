import jwt
from datetime import datetime, timedelta
from django.conf import settings
from functools import wraps
from django.http import JsonResponse

def generate_jwt(payload, user_type='student'):
    """Generate a JWT for a specific user type"""
    if user_type == 'student':
        expiry = datetime.utcnow() + timedelta(minutes=30)
    else:
        # Admin or other types
        expiry = datetime.utcnow() + timedelta(days=1)
        
    payload.update({
        'exp': expiry,
        'user_type': user_type,
        'iat': datetime.utcnow()
    })
    return jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')

def verify_jwt(token):
    """Verify a JWT and return the payload"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def jwt_required(view_func):
    """Decorator to require a valid JWT in the Authorization header"""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return JsonResponse({'status': 'error', 'error': 'authentication required'}, status=401)
        
        token = auth_header.split(' ')[1]
        payload = verify_jwt(token)
        
        if not payload:
            return JsonResponse({'status': 'error', 'error': 'invalid or expired token'}, status=401)
        
        # Attach payload to request for use in view
        request.jwt_payload = payload
        return view_func(request, *args, **kwargs)
    return wrapper

def jwt_admin_required(view_func):
    """
    Decorator for views that require JWT and specifically the 'admin' role.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return JsonResponse({'status': 'error', 'error': 'authentication required'}, status=401)
        
        token_str = auth_header.split(' ')[1] if ' ' in auth_header else auth_header
        
        try:
            from rest_framework_simplejwt.authentication import JWTAuthentication
            authenticator = JWTAuthentication()
            validated_token = authenticator.get_validated_token(token_str)
            user = authenticator.get_user(validated_token)
            
            if user:
                if not user.is_active:
                    return JsonResponse({'status': 'error', 'error': 'user is inactive'}, status=403)
                
                # Check admin role
                if user.role != 'admin':
                    return JsonResponse({'status': 'error', 'error': 'admin access required'}, status=403)
                
                # Enforce first login password change
                if getattr(user, 'is_first_login', False):
                    return JsonResponse({'status': 'error', 'error': 'first_login_required'}, status=403)
                
                request.user = user
                return view_func(request, *args, **kwargs)
            else:
                return JsonResponse({'status': 'error', 'error': 'invalid user'}, status=401)
        except Exception as e:
            return JsonResponse({'status': 'error', 'error': str(e)}, status=401)
            
    return _wrapped_view

def jwt_hod_or_admin_required(view_func):
    """
    Decorator for views that allow both 'admin' and 'hod' roles.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return JsonResponse({'status': 'error', 'error': 'authentication required'}, status=401)
        
        token_str = auth_header.split(' ')[1] if ' ' in auth_header else auth_header
        
        try:
            from rest_framework_simplejwt.authentication import JWTAuthentication
            authenticator = JWTAuthentication()
            validated_token = authenticator.get_validated_token(token_str)
            user = authenticator.get_user(validated_token)
            
            if user:
                if not user.is_active:
                    return JsonResponse({'status': 'error', 'error': 'user is inactive'}, status=403)
                
                # Role Check: MUST BE ADMIN OR HOD
                if user.role not in ['admin', 'hod']:
                    return JsonResponse({'status': 'error', 'error': 'access denied'}, status=403)
                
                # Enforce first login password change
                if getattr(user, 'is_first_login', False):
                    return JsonResponse({'status': 'error', 'error': 'first_login_required'}, status=403)
                
                request.user = user
                return view_func(request, *args, **kwargs)
            else:
                return JsonResponse({'status': 'error', 'error': 'invalid user'}, status=401)
        except Exception as e:
            return JsonResponse({'status': 'error', 'error': str(e)}, status=401)
            
    return _wrapped_view
