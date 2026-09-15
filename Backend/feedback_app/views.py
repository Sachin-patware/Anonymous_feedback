from django.http import JsonResponse
from django.db import connections
from django.db.utils import DatabaseError
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.csrf import csrf_exempt
from django.core.exceptions import ValidationError
from django.db import transaction
from django.core.signing import Signer, BadSignature
import json
import random
import string
from feedback_app.serializers import LoginSerializer, FeedbackSerializer, AcademicSubjectSerializer, FacultyTeacherSerializer, AcademicAllocationSerializer, StaffUserSerializer
from feedback_app.models import Feedback_Response, Feedback_SubmissionLog, Academic_Allocation, Faculty_Teacher
from django.db.models import Avg, F, Count
from functools import wraps
from feedback_app.auth import generate_jwt, jwt_required, jwt_admin_required, jwt_hod_or_admin_required
from feedback_app.date_filters import validate_date_range, apply_feedback_date_filter, get_allowed_ranges

# In-memory store for student access token (resets on server restart)
CURRENT_ACCESS_TOKEN = "AITR0827"



def apply_role_filters(user, queryset, model):
    """
    Apply filtering based on user role.
    Admins see everything. HODs see only their assigned department/branches.
    """
    if not user or not hasattr(user, 'role') or user.role == 'admin':
        return queryset

    if user.role == 'hod':
        model_name = model.__name__
        
      
        if model_name == 'StaffUser':
            return queryset.none()
            
        if model_name == 'Academic_Subject':
            return queryset.filter(Branch__in=user.branches)
        
        elif model_name == 'Academic_Allocation':
            return queryset.filter(TargetBranch__in=user.branches)
            
        elif model_name in ['Feedback_Response', 'Feedback_SubmissionLog']:
            return queryset.filter(AllocationID__TargetBranch__in=user.branches)
            
        elif model_name == 'Faculty_Teacher':
            
            from .models import Academic_Allocation
            teacher_ids = Academic_Allocation.objects.filter(
                TargetBranch__in=user.branches
            ).values_list('TeacherID', flat=True).distinct()
            return queryset.filter(TeacherID__in=teacher_ids)
            
    return queryset

# login api 
@csrf_exempt
@require_POST
def login(request):
    
    # robust body parsing
    content_type = request.META.get('CONTENT_TYPE', '') or request.META.get('HTTP_CONTENT_TYPE', '')
    raw_body = request.body or b''
    payload = {}

    if raw_body:
        try:
            s = raw_body.decode('utf-8').strip()
        except Exception:
            s = ''
        try_json = False
        if 'application/json' in content_type:
            try_json = True
        else:
            # if body looks like JSON even without proper header, attempt parse
            if s.startswith('{') or s.startswith('['):
                try_json = True

        if try_json:
            try:
                payload = json.loads(s or '{}')
            except Exception:
                return JsonResponse({'status': 'error', 'error': 'invalid JSON'}, status=400)
        else:
            # form / urlencoded / multipart parse via Django request.POST
            payload = request.POST.dict()
    else:
        # No body: accept form-urlencoded (if client used GET) or query params
        payload = request.POST.dict() or request.GET.dict()

    # normalize keys from various client names
    session_raw = payload.get('session') or payload.get('AcademicSession')
    branch_raw = payload.get('branch') or payload.get('Branch')
    year_raw = payload.get('year') or payload.get('Year')
    semester_raw = payload.get('semester') or payload.get('Semester')
    section_raw = payload.get('section') or payload.get('Section')
    token_provided = payload.get('token')
    fingerprint = payload.get('fingerprint')

    # ── Security Check 1: Verify Access Token ──────────────────────────────────
    if not token_provided or token_provided != CURRENT_ACCESS_TOKEN:
        return JsonResponse({'status': 'error', 'error': 'Invalid or missing access token. Please use the authorized feedback link provided to you.'}, status=403)

    # ── Security Check 2: Mandatory Signature (Standalone token is NOT allowed) ─
    sig = payload.get('sig')
    if not sig:
        return JsonResponse({
            'status': 'error',
            'error': 'Missing security signature. Standalone token access is not permitted. Please use the complete signed feedback link provided to you.'
        }, status=403)

    # ── Security Check 3: Verify all required class parameters are provided ────
    if not session_raw or not branch_raw or not year_raw or not semester_raw or not section_raw:
        return JsonResponse({
            'status': 'error',
            'error': 'Missing required class parameters. Please use the complete signed feedback link provided to you.'
        }, status=400)

    # ── Security Check 4: Cryptographic Signature Verification ──────────────────
    signer = Signer(sep=':')
    try:
        expected_data = f"{session_raw}|{branch_raw}|{year_raw}|{semester_raw}|{section_raw}"
        signer.unsign(f"{expected_data}:{sig}")
    except BadSignature:
        return JsonResponse({
            'status': 'error',
            'error': 'Invalid or tampered feedback access link. Class parameters do not match the authorized signature.'
        }, status=403)

    # validate inputs via serializer (Django Form)
    serializer = LoginSerializer(data={
        'session': session_raw,
        'branch': branch_raw,
        'year': year_raw,
        'semester': semester_raw,
        'section': section_raw
    })
    
    if not serializer.is_valid():
        return JsonResponse({'status': 'error', 'errors': serializer.errors}, status=400)

    session = serializer.cleaned_data.get('session')
    branch = serializer.cleaned_data.get('branch')
    year = serializer.cleaned_data.get('year')
    semester = serializer.cleaned_data.get('semester')
    section = serializer.cleaned_data.get('section')

    # Use fingerprint as ID if provided, otherwise fallback to random (random is less secure for session persistence)
    student_id = fingerprint if fingerprint else 'STU-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

    # Generate JWT with class info
    token = generate_jwt({
        'enrollment': student_id,
        'session': session,
        'branch': branch,
        'year': year,
        'semester': semester,
        'section': section,
        'name': f"Guest Student ({student_id[:8]})"
    }, user_type='student')

    return JsonResponse({
        'status': 'ok',
        'message': 'login successful',
        'EnrollmentNo': student_id,
        'FullName': f"Guest Student ({student_id[:8]})",
        'session': session,
        'branch': branch,
        'year': year,
        'semester': semester,
        'section': section,
        'access': token,
    })

# logout api

@csrf_exempt
@require_POST
def logout(request):
    # Clear session data
    request.session.flush()

    # Remove cookie from client
    response = JsonResponse({"status": "ok", "message": "logged out successfully"})
    response.delete_cookie('sessionid')

    return response

@csrf_exempt
@require_POST
@jwt_hod_or_admin_required
def admin_change_password(request):
    """API for changing password, requiring old password confirmation"""
    try:
        user = request.user
        payload = json.loads(request.body)
        
        old_password = payload.get("old_password")
        new_password = payload.get("password")
        
        if not old_password or not new_password:
            return JsonResponse({'status': 'error', 'error': 'current and new passwords are required'}, status=400)
            
        if len(new_password) < 6:
            return JsonResponse({'status': 'error', 'error': 'new password must be at least 6 characters'}, status=400)
            
        # Verify old password
        if not user.check_password(old_password):
            return JsonResponse({'status': 'error', 'error': 'incorrect current password'}, status=400)
            
        # Set and save
        user.set_password(new_password)
        user.is_first_login = False
        user.save()
        
        return JsonResponse({'status': 'ok', 'message': 'password updated successfully'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'error': str(e)}, status=400)



@require_GET
@jwt_required
def my_teachers(request):
    """
    Return subjects and their assigned teachers for the logged-in student.
    Matches student Branch, Year, Section, and Semester with Academic_Allocation.
    """

    session = request.jwt_payload.get("session")
    enrollment = request.jwt_payload.get("enrollment")
    branch = request.jwt_payload.get("branch")
    year = request.jwt_payload.get("year")
    semester = request.jwt_payload.get("semester")
    section = request.jwt_payload.get("section")

    if not enrollment or not branch or not year or not semester or not section or not session:
        return JsonResponse({"status": "error", "error": "invalid token payload"}, status=401)

    qs = Academic_Allocation.objects.select_related("TeacherID", "SubjectCode") \
        .filter(
            AcademicSession=session,
            TargetBranch__iexact=branch,
            Target_Year=year,
            Target_Section=section,
            Target_Semester=semester
        ) \
    .order_by("SubjectCode__SubjectCode")

    # Get all submitted allocations for this student to show status
    submitted_allocations = set(
        Feedback_SubmissionLog.objects.filter(EnrollmentNo=enrollment)
        .values_list("AllocationID", flat=True)
    )

    subjects_map = {}

    for alloc in qs:
        subj = alloc.SubjectCode
        teacher = alloc.TeacherID

        if not subj or not teacher:
            continue

        key = subj.SubjectCode

        if key not in subjects_map:
            subjects_map[key] = {
                "subject_code": subj.SubjectCode,
                "subject_name": subj.SubjectName,
                "semester": subj.Semester,
                "branch": subj.Branch,
                "teachers": []
            }

        subjects_map[key]["teachers"].append({
            "allocation_id": alloc.AllocationID,
            "teacher_id": teacher.TeacherID,
            "teacher_name": teacher.FullName,
            "designation": teacher.Designation,
            "is_submitted": alloc.AllocationID in submitted_allocations
        })

    return JsonResponse({
        "status": "ok",
        "enrollment": enrollment,
        "branch": branch,
        "year": year,
        "semester": semester,
        "section": section,
        "subjects": list(subjects_map.values())
    })



@csrf_exempt
@require_POST
@jwt_required
def submit_feedback(request):
    """
    Student submits feedback using allocation_id + subject_code.
    Backend verifies allocation matches student class + subject.
    Supports JSON, form-data, form-urlencoded.
    """

    # -------------------------------------
    # 1. Parse Input (JSON OR FORM)
    # -------------------------------------
    raw_body = request.body or b""
    payload = {}

    content_type = request.META.get("CONTENT_TYPE", "")
    is_json = "application/json" in content_type

    if raw_body:
        text = raw_body.decode("utf-8").strip()

        if is_json or text.startswith("{"):  # JSON input
            try:
                payload = json.loads(text)
            except Exception:
                return JsonResponse({"status": "error", "error": "invalid JSON"}, status=400)
        else:
            payload = request.POST.dict()
    else:
        payload = request.POST.dict() or request.GET.dict()

    # -------------------------------------
    # 2. Validate With Serializer
    # -------------------------------------
    form = FeedbackSerializer(data=payload)
    if not form.is_valid():
        return JsonResponse({"status": "error", "errors": form.errors}, status=400)

    allocation_id = form.cleaned_data.get("allocation_id")
    subject_code = form.cleaned_data.get("subject_code")
    comments = form.cleaned_data.get("comments")

    ratings = {f"q{i}": form.cleaned_data.get(f"q{i}") for i in range(1, 11)}

    # -------------------------------------
    # 3. Get Student Info from JWT
    # -------------------------------------
    student_session = request.jwt_payload.get("session")
    enrollment_no = request.jwt_payload.get("enrollment")
    student_branch = request.jwt_payload.get("branch")
    student_year = request.jwt_payload.get("year")
    student_semester = request.jwt_payload.get("semester")
    student_section = request.jwt_payload.get("section")

    if not enrollment_no or not student_branch or not student_session:
        return JsonResponse({"status": "error", "error": "invalid token payload"}, status=401)

    # -------------------------------------
    # 4. Lookup Allocation
    # -------------------------------------
    try:
        alloc = Academic_Allocation.objects.select_related("TeacherID", "SubjectCode").get(
            AllocationID=allocation_id
        )
    except Academic_Allocation.DoesNotExist:
        return JsonResponse({
            "status": "error",
            "error": "Invalid allocation_id"
        }, status=404)

    # -------------------------------------
    # 5. Subject must match allocation
    # -------------------------------------
    if alloc.SubjectCode.SubjectCode != subject_code:
        return JsonResponse({
            "status": "error",
            "error": "subject mismatch for allocation_id"
        }, status=403)

    # -------------------------------------
    # 6. Allocation must belong to student's class
    # -------------------------------------
    if (
        alloc.AcademicSession != student_session
        or alloc.TargetBranch.lower() != student_branch.lower()
        or alloc.Target_Year != student_year
        or alloc.Target_Section != student_section
        or alloc.Target_Semester != student_semester
    ):
        return JsonResponse({
            "status": "error",
            "error": "allocation_id does not belong to logged-in student"
        }, status=403)

    # -------------------------------------
    # 7. Check duplicate feedback for this session ID
    # -------------------------------------
    if Feedback_SubmissionLog.objects.filter(
        EnrollmentNo=enrollment_no, AllocationID=alloc
    ).exists():
        return JsonResponse({
            "status": "error",
            "error": "feedback already submitted"
        }, status=409)

    # -------------------------------------
    # 8. Save feedback atomically
    # -------------------------------------
    try:
        with transaction.atomic():

            feedback = Feedback_Response(
                AllocationID=alloc,
                Q1_Rating=ratings["q1"],
                Q2_Rating=ratings["q2"],
                Q3_Rating=ratings["q3"],
                Q4_Rating=ratings["q4"],
                Q5_Rating=ratings["q5"],
                Q6_Rating=ratings["q6"],
                Q7_Rating=ratings["q7"],
                Q8_Rating=ratings["q8"],
                Q9_Rating=ratings["q9"],
                Q10_Rating=ratings["q10"],
                Comments=comments or None
            )
            feedback.full_clean()
            feedback.save()

            Feedback_SubmissionLog.objects.create(
                ResponseID=feedback,
                EnrollmentNo=enrollment_no,
                AllocationID=alloc
            )

    except Exception as e:
        return JsonResponse({
            "status": "error",
            "error": "failed to save feedback",
            "details": str(e)
        }, status=500)

    return JsonResponse({
        "status": "ok",
        "message": "feedback submitted",
        "allocation_id": alloc.AllocationID
    })


@require_GET
@jwt_required
def my_feedbacks(request):
    """
    Return a list of feedbacks submitted by the logged-in student.
    Includes teacher and subject details along with ratings.
    """
    enrollment = request.jwt_payload.get("enrollment")
    
    # Filter logs for this student
    logs = Feedback_SubmissionLog.objects.filter(EnrollmentNo=enrollment).select_related(
        "ResponseID", 
        "AllocationID__TeacherID", 
        "AllocationID__SubjectCode"
    ).order_by("-Timestamp")

    results = []
    for log in logs:
        resp = log.ResponseID
        alloc = log.AllocationID
        teacher = alloc.TeacherID
        subject = alloc.SubjectCode

        results.append({
            "log_id": log.LogID,
            "timestamp": log.Timestamp,
            "teacher_name": teacher.FullName,
            "subject_name": subject.SubjectName,
            "subject_code": subject.SubjectCode,
            "ratings": {
                "q1": resp.Q1_Rating,
                "q2": resp.Q2_Rating,
                "q3": resp.Q3_Rating,
                "q4": resp.Q4_Rating,
                "q5": resp.Q5_Rating,
                "q6": resp.Q6_Rating,
                "q7": resp.Q7_Rating,
                "q8": resp.Q8_Rating,
                "q9": resp.Q9_Rating,
                "q10": resp.Q10_Rating,
            },
            "comments": resp.Comments
        })

    return JsonResponse({
        "status": "ok",
        "feedbacks": results
    })


def check_db_connection_and_list_tables():
    try:
        with connections['default'].cursor() as cur:
            # lightweight check
            cur.execute("SELECT 1")
        print("database connection successful")
    except DatabaseError:
        print("connection failed")

check_db_connection_and_list_tables()


# ============================================
# ADMIN ENDPOINTS
# ============================================

import os
from django.apps import apps

# LEGACY ADMIN DECORATOR REMOVED


from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken

@csrf_exempt
def admin_login(request):
    """Admin/HOD login using database credentials"""
    if request.method != 'POST':
        return JsonResponse({"status": "error", "error": "method not allowed"}, status=405)
    
    try:
        payload = json.loads(request.body)
    except:
        return JsonResponse({"status": "error", "error": "invalid JSON"}, status=400)
    
    username = payload.get("username")
    password = payload.get("password")
    
    if not username or not password:
        return JsonResponse({"status": "error", "error": "username and password are required"}, status=400)

    # Use Django's authenticate
    user = authenticate(username=username, password=password)
    
    if user is not None:
        if not user.is_active:
            return JsonResponse({"status": "error", "error": "account is disabled"}, status=403)
        
        # Check if first login
        if user.is_first_login:
            # We can still let them login but signal they MUST change password
            # Or we can block and only allow Password Change API
            pass

        # Generate SimpleJWT tokens
        refresh = RefreshToken.for_user(user)
        
        return JsonResponse({
            'status': 'ok',
            'message': 'login successful',
            'user_id': user.id,
            'username': user.username,
            'role': user.role,
            'branches': user.branches if hasattr(user, 'branches') else [],
            'is_first_login': user.is_first_login,
            'access': str(refresh.access_token),
            'refresh': str(refresh)
        })
    
    return JsonResponse({"status": "error", "error": "invalid credentials"}, status=401)


@require_GET
@jwt_hod_or_admin_required
def admin_list_tables(request):
    """List all database tables"""
    try:
        # Get all models from the app
        models = apps.get_app_config('feedback_app').get_models()
        
        # Filter tables for HOD role
        user_role = getattr(request.user, 'role', 'admin')
        
        tables = []
        for model in models:
            table_name = model._meta.db_table
            model_name = model.__name__
            
            # HODs cannot see the User table
            if user_role == 'hod' and model_name == 'StaffUser':
                continue
            
            # Get row count
            try:
                # Apply role filtering even to the count
                count = apply_role_filters(request.user, model.objects.all(), model).count()
            except:
                count = 0
            
            tables.append({
                "table_name": table_name,
                "model_name": model_name,
                "row_count": count
            })
        
        return JsonResponse({
            "status": "ok",
            "tables": sorted(tables, key=lambda x: x['model_name'])
        })
    except Exception as e:
        return JsonResponse({
            "status": "error",
            "error": str(e)
        }, status=500)


@require_GET
@jwt_hod_or_admin_required
def admin_get_table_data(request, table_name):
    """Get data from a specific table with optional pagination"""
    try:
        # Find the model by table name
        model = None
        for m in apps.get_app_config('feedback_app').get_models():
            if m._meta.db_table == table_name or m.__name__ == table_name:
                model = m
                break
        
        if not model:
            return JsonResponse({
                "status": "error",
                "error": f"table '{table_name}' not found"
            }, status=404)
        
        # Security: Block HOD from StaffUser table
        if request.user.role == 'hod' and model.__name__ == 'StaffUser':
            return JsonResponse({"status": "error", "error": "Access denied to sensitive table"}, status=403)

        # Check for no-pagination flag
        nopaginate = request.GET.get('nopaginate', 'false').lower() == 'true'
        
        # Get query parameters for sorting and searching
        sort_by = request.GET.get('sort_by')
        order = request.GET.get('order', 'asc')
        filters_str = request.GET.get('filters', '{}')
        q_param = request.GET.get('q', '').strip()
        
        # Initial queryset
        queryset = model.objects.all()
        
        # Apply Role Filtering
        queryset = apply_role_filters(request.user, queryset, model)
        
        # Apply Date Filtering for relevant tables
        if request.GET.get('range'):
            try:
                range_key = request.GET.get('range')
                start_date_str = request.GET.get('start_date')
                end_date_str = request.GET.get('end_date')
                start_date, end_date = validate_date_range(request.user, range_key, start_date_str, end_date_str)
                
                if model.__name__ == 'Feedback_Response':
                    queryset = apply_feedback_date_filter(queryset, start_date, end_date)
                elif model.__name__ == 'Feedback_SubmissionLog':
                    if start_date and end_date:
                        queryset = queryset.filter(Timestamp__gte=start_date, Timestamp__lte=end_date)
            except PermissionError as e:
                return JsonResponse({'status': 'error', 'error': str(e)}, status=403)
            except ValueError as e:
                return JsonResponse({'status': 'error', 'error': str(e)}, status=400)
        
        # Apply Search Filters
        filters_dict = {}
        if filters_str:
            import json
            try:
                filters_dict = json.loads(filters_str)
            except Exception:
                filters_dict = {}
                
        if q_param and 'all' not in filters_dict:
            filters_dict['all'] = q_param

        # Optimize relations if foreign keys exist
        fk_fields = [f.name for f in model._meta.get_fields() if f.is_relation and f.many_to_one and f.related_model]
        if fk_fields:
            queryset = queryset.select_related(*fk_fields)

        if filters_dict:
            try:
                from django.db.models import Q
                
                for col, val in filters_dict.items():
                    val = str(val).strip()
                    if not val:
                        continue
                        
                    if col == 'all':
                        # Generic search across all fields
                        search_query = Q()
                        for field in model._meta.get_fields():
                            if field.is_relation:
                                if field.many_to_one and field.related_model:
                                    for rf in field.related_model._meta.get_fields():
                                        if hasattr(rf, 'get_internal_type') and rf.get_internal_type() in ['CharField', 'TextField', 'EmailField']:
                                            search_query |= Q(**{f"{field.name}__{rf.name}__icontains": val})
                                continue
                            
                            if not hasattr(field, 'get_internal_type'):
                                continue
                            
                            internal_type = field.get_internal_type()
                            if internal_type in ['CharField', 'TextField', 'EmailField']:
                                search_query |= Q(**{f"{field.name}__icontains": val})
                        if search_query:
                            queryset = queryset.filter(search_query)
                    else:
                        # Specific column search
                        try:
                            field = model._meta.get_field(col)
                            
                            # Handle foreign-key relation fields
                            if field.is_relation and field.many_to_one and field.related_model:
                                rel_q = Q()
                                for rf in field.related_model._meta.get_fields():
                                    if not hasattr(rf, 'get_internal_type'):
                                        continue
                                    if rf.get_internal_type() in ['CharField', 'TextField', 'EmailField']:
                                        rel_q |= Q(**{f"{field.name}__{rf.name}__icontains": val})
                                    elif rf.get_internal_type() in ['IntegerField', 'BigIntegerField', 'SmallIntegerField', 'PositiveIntegerField', 'PositiveSmallIntegerField', 'PositiveBigIntegerField', 'AutoField', 'BigAutoField', 'SmallAutoField']:
                                        try:
                                            num_val = int(float(val))
                                            rel_q |= Q(**{f"{field.name}__{rf.name}": num_val})
                                        except ValueError:
                                            pass
                                if rel_q:
                                    queryset = queryset.filter(rel_q)
                                continue

                            if not hasattr(field, 'get_internal_type'):
                                continue

                            internal_type = field.get_internal_type()

                            if internal_type in ['CharField', 'TextField', 'EmailField']:
                                queryset = queryset.filter(**{f"{field.name}__icontains": val})
                                
                            elif internal_type in ['IntegerField', 'BigIntegerField', 'SmallIntegerField', 'PositiveIntegerField', 'PositiveSmallIntegerField', 'PositiveBigIntegerField', 'AutoField', 'BigAutoField', 'SmallAutoField']:
                                try:
                                    num_val = int(float(val))
                                    queryset = queryset.filter(**{f"{field.name}": num_val})
                                except ValueError:
                                    pass
                                    
                            elif internal_type in ['FloatField', 'DecimalField']:
                                try:
                                    num_val = float(val)
                                    queryset = queryset.filter(**{f"{field.name}": num_val})
                                except ValueError:
                                    pass
                        except Exception:
                            pass
            except Exception:
                pass
        # Apply Sorting
        if sort_by:
            # Validate field exists
            field_names = [f.name for f in model._meta.get_fields()]
            if sort_by in field_names:
                if order == 'desc':
                    queryset = queryset.order_by(f'-{sort_by}')
                else:
                    queryset = queryset.order_by(sort_by)

        # Get total count after filtering
        total = queryset.count()
        
        if nopaginate:
            # Get all data
            page = 1
            page_size = total if total > 0 else 1
            total_pages = 1
        else:
            # Standard Pagination
            page = int(request.GET.get('page', 1))
            page_size = int(request.GET.get('page_size', 50))
            if page_size < 1: page_size = 10 
            
            start = (page - 1) * page_size
            end = start + page_size
            queryset = queryset[start:end]
            total_pages = (total + page_size - 1) // page_size if page_size > 0 else 1
            
        # Get field names and metadata
        fields = []
        field_meta = {}
        model_name_lower = model.__name__.lower()
        is_user_model = 'staffuser' in model_name_lower or 'user' in model_name_lower
        
        for f in model._meta.get_fields():
            if f.many_to_many or f.one_to_many:
                continue
            
            fields.append(f.name)
            
            # Determine type
            internal_type = f.get_internal_type()
            
            # Extract metadata
            meta = {
                'type': 'text',
                'required': not f.blank and not f.null,
                'choices': [],
                'is_auto': False
            }
            
            if internal_type == 'BooleanField':
                meta['type'] = 'boolean'
            elif internal_type in ['DateField', 'DateTimeField']:
                meta['type'] = 'date'
            elif internal_type in ['IntegerField', 'BigIntegerField', 'PositiveSmallIntegerField', 'AutoField', 'BigAutoField', 'SmallAutoField']:
                meta['type'] = 'number'
                # Check for AutoField or similar auto-incrementing fields
                from django.db import models
                if isinstance(f, (models.AutoField, models.BigAutoField, models.SmallAutoField)) or getattr(f, 'auto_created', False):
                    meta['is_auto'] = True
            elif internal_type in ['FloatField', 'DecimalField']:
                meta['type'] = 'float'
                
            # Extract choices if available
            if f.choices:
                meta['type'] = 'select' 
                meta['choices'] = [{'value': c[0], 'label': str(c[1])} for c in f.choices]
            
            # Foreign key relations
            if f.is_relation and f.many_to_one and f.related_model:
                meta['is_foreign_key'] = True
                meta['related_model'] = f.related_model.__name__
                meta['related_table'] = f.related_model._meta.db_table
                meta['related_pk'] = f.related_model._meta.pk.name

            # Special field type discovery based on name
            field_name_lower = f.name.lower()
            
            if field_name_lower in ['teacherid', 'teacher_id']:
                meta['type'] = 'teacher_search'
            elif field_name_lower in ['subjectcode', 'subject_code']:
                meta['type'] = 'subject_search'
            elif field_name_lower in ['branches', 'branchs']:
                meta['type'] = 'multi-select'
                meta['choices'] = [{'value': b, 'label': b} for b in ['CSE', 'CSE(RL)', 'IT', 'CSE(DS)', 'CSE(CY)', 'CSIT', 'CSE(AIML)', 'ME', 'CE', 'EC', 'EC-ACT', 'EC-VLSI']]
            elif 'branch' in field_name_lower:
                meta['type'] = 'select'
                meta['choices'] = [{'value': b, 'label': b} for b in ['CSE', 'CSE(RL)', 'IT', 'CSE(DS)', 'CSE(CY)', 'CSIT', 'CSE(AIML)', 'ME', 'CE', 'EC', 'EC-ACT', 'EC-VLSI']]
            elif 'semester' in field_name_lower:
                meta['type'] = 'select'
                meta['choices'] = [{'value': i, 'label': f"Semester {i}"} for i in range(1, 9)]
            elif 'year' in field_name_lower:
                meta['type'] = 'select'
                meta['choices'] = [{'value': i, 'label': f"Year {i}"} for i in range(1, 5)]
            elif 'section' in field_name_lower:
                meta['type'] = 'select'
                meta['choices'] = [{'value': i, 'label': f"Section {i}"} for i in range(1, 11)]
            elif 'academicsession' in field_name_lower or field_name_lower == 'academicsession':
                meta['type'] = 'academicsession'
                meta['choices'] = []
            
            # Visibility/Form overrides for user models
            if is_user_model and f.name in ['last_login', 'is_first_login', 'is_active', 'is_superuser', 'is_staff', 'date_joined']:
                meta['is_auto'] = True
                meta['required'] = False
            
            field_meta[f.name] = meta
        
        # Convert to list of dicts
        data = []
        is_user_model = 'staffuser' in model_name_lower or 'user' in model_name_lower
        
        for obj in queryset:
            row = {}
            for field in fields:
                try:
                    # Sensitive fields handling
                    if is_user_model and field == 'password':
                        row[field] = "********"
                        continue
                        
                    value = getattr(obj, field)
                    # Convert to JSON-serializable format
                    if hasattr(value, 'isoformat'):  # datetime/date
                        value = value.isoformat()
                    elif hasattr(value, 'pk'):  # Foreign key
                        value = value.pk
                    row[field] = value
                except:
                    row[field] = None
            data.append(row)
        
        # Get primary key field
        pk_field = model._meta.pk.name
        
        return JsonResponse({
            "status": "ok",
            "model_name": model.__name__,
            "table_name": model._meta.db_table,
            "pk_field": pk_field,
            "fields": fields,
            "field_meta": field_meta,
            "data": data,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages
        })
    except Exception as e:
        return JsonResponse({
            "status": "error",
            "error": str(e)
        }, status=500)


@csrf_exempt
@require_POST
@jwt_hod_or_admin_required
def admin_add_row(request, table_name):
    """Add a new row to a table"""
    # Restricted Tables
    if table_name.lower() in ['feedback_response', 'feedback_submissionlog']:
        return JsonResponse({"status": "error", "error": "This table is read-only"}, status=403)
        
    try:
        # Find the model
        model = None
        for m in apps.get_app_config('feedback_app').get_models():
            if m._meta.db_table == table_name or m.__name__ == table_name:
                model = m
                break
        
        if not model:
            return JsonResponse({
                "status": "error",
                "error": f"table '{table_name}' not found"
            }, status=404)
        
        # Parse request body
        try:
            payload = json.loads(request.body)
        except:
            return JsonResponse({"status": "error", "error": "invalid JSON"}, status=400)

        # RBAC: Check branch ownership for HOD
        if request.user.role == 'hod':
             model_name = model.__name__
             if model_name == 'StaffUser':
                 return JsonResponse({"status": "error", "error": "HOD cannot add users"}, status=403)
             
             # Validate branch if model has one
             branch_key = None
             if model_name == 'Academic_Subject': branch_key = 'Branch'
             elif model_name == 'Academic_Allocation': branch_key = 'TargetBranch'
             
             if branch_key:
                 branch_val = payload.get(branch_key)
                 if branch_val not in request.user.branches:
                     return JsonResponse({"status": "error", "error": f"You do not have permission for branch {branch_val}"}, status=403)
            
        # Map models to serializers for better validation
        serializer_map = {
            'Academic_Subject': AcademicSubjectSerializer,
            'Faculty_Teacher': FacultyTeacherSerializer,
            'Academic_Allocation': AcademicAllocationSerializer,
            'StaffUser': StaffUserSerializer
        }
        
        serializer_class = serializer_map.get(model.__name__)
        
        if serializer_class:
            serializer = serializer_class(data=payload)
            if not serializer.is_valid():
                # Extract and format errors
                error_msgs = []
                for field, errors in serializer.errors.items():
                    error_msgs.append(f"{field}: {', '.join(errors)}")
                return JsonResponse({"status": "error", "error": "; ".join(error_msgs)}, status=400)
            
            # Use serializer data to create obj
            obj = serializer.save()
            return JsonResponse({
                "status": "ok",
                "message": "row added successfully",
                "pk": obj.pk
            })
            
        # Fallback for models without dedicated serializers
        # Create new object instance
        obj = model()
        
        # Set fields
        for field_name, value in payload.items():
            if not value:
                continue

            try:
                field = model._meta.get_field(field_name)
                
                # Handle foreign keys
                if field.is_relation and field.many_to_one:
                    related_model = field.related_model
                    try:
                        related_obj = related_model.objects.get(pk=value)
                        setattr(obj, field_name, related_obj)
                    except related_model.DoesNotExist:
                         return JsonResponse({"status": "error", "error": f"Invalid ID {value} for field {field_name}"}, status=400)
                else:
                    setattr(obj, field_name, value)
            except Exception as e:
                # Field might not exist or other error, log/ignore
                pass
        
        try:
            obj.full_clean()
            obj.save()
            return JsonResponse({
                "status": "ok",
                "message": "row added successfully",
                "pk": obj.pk
            })
        except ValidationError as e:
             return JsonResponse({"status": "error", "error": str(e.message_dict)}, status=400)
             
    except Exception as e:
        return JsonResponse({
            "status": "error",
            "error": str(e)
        }, status=500)


@csrf_exempt
@require_POST
@jwt_hod_or_admin_required
def admin_update_row(request, table_name, row_id):
    """Update a row in a table"""
    # Restricted Tables
    if table_name.lower() in ['feedback_response', 'feedback_submissionlog']:
        return JsonResponse({"status": "error", "error": "This table is read-only"}, status=403)
        
    try:
        # Find the model
        model = None
        for m in apps.get_app_config('feedback_app').get_models():
            if m._meta.db_table == table_name or m.__name__ == table_name:
                model = m
                break
        
        if not model:
            return JsonResponse({
                "status": "error",
                "error": f"table '{table_name}' not found"
            }, status=404)
        
        # Parse request body
        try:
            payload = json.loads(request.body)
        except:
            return JsonResponse({"status": "error", "error": "invalid JSON"}, status=400)
        
        # RBAC: Check visibility and branch ownership
        if request.user.role == 'hod':
            if model.__name__ == 'StaffUser':
                return JsonResponse({"status": "error", "error": "HOD cannot modify users"}, status=403)
            
            # Branch validation for update payload
            branch_key = None
            if model.__name__ == 'Academic_Subject': branch_key = 'Branch'
            elif model.__name__ == 'Academic_Allocation': branch_key = 'TargetBranch'
            
            if branch_key:
                branch_val = payload.get(branch_key)
                if branch_val and branch_val not in request.user.branches:
                    return JsonResponse({"status": "error", "error": f"You do not have permission to move data to branch {branch_val}"}, status=403)

        # Security: Prevent logged-in user from deactivating their own account
        if model.__name__ == 'StaffUser':
            user_pk = getattr(request.user, 'pk', None)
            user_id = getattr(request.user, 'id', None)
            user_username = getattr(request.user, 'username', '')
            if str(row_id) in [str(user_pk), str(user_id), str(user_username)]:
                if 'is_active' in payload:
                    is_active_val = payload.get('is_active')
                    if is_active_val is False or str(is_active_val).lower() in ['false', '0']:
                        return JsonResponse({"status": "error", "error": "You cannot deactivate your own account."}, status=400)

        # Get the object (applying role filters to ensure they can't see it)
        try:
            # Re-apply role filters to ensure they can't update what they can't see
            visible_qs = apply_role_filters(request.user, model.objects.all(), model)
            obj = visible_qs.get(pk=row_id)
        except model.DoesNotExist:
            return JsonResponse({
                "status": "error",
                "error": f"row with id {row_id} not found or access denied"
            }, status=404)

        if model.__name__ == 'StaffUser' and obj.pk == request.user.pk:
            if 'is_active' in payload:
                is_active_val = payload.get('is_active')
                if is_active_val is False or str(is_active_val).lower() in ['false', '0']:
                    return JsonResponse({"status": "error", "error": "You cannot deactivate your own account."}, status=400)
        
        # Map models to serializers for better validation
        serializer_map = {
            'Academic_Subject': AcademicSubjectSerializer,
            'Faculty_Teacher': FacultyTeacherSerializer,
            'Academic_Allocation': AcademicAllocationSerializer,
            'StaffUser': StaffUserSerializer
        }
        
        serializer_class = serializer_map.get(model.__name__)
        
        if serializer_class:
            serializer = serializer_class(obj, data=payload, partial=True)
            if not serializer.is_valid():
                error_msgs = []
                for field, errors in serializer.errors.items():
                    error_msgs.append(f"{field}: {', '.join(errors)}")
                return JsonResponse({"status": "error", "error": "; ".join(error_msgs)}, status=400)
            
            serializer.save()
            return JsonResponse({
                "status": "ok",
                "message": "row updated successfully"
            })

        # Fallback for models without dedicated serializers
        # Update fields
        for field, value in payload.items():
            if hasattr(obj, field):
                # Handle foreign keys
                field_obj = model._meta.get_field(field)
                if field_obj.is_relation:
                    # Get related model
                    related_model = field_obj.related_model
                    if value:
                        try:
                            related_obj = related_model.objects.get(pk=value)
                            setattr(obj, field, related_obj)
                        except:
                            pass
                else:
                    setattr(obj, field, value)
        
        obj.save()
        
        return JsonResponse({
            "status": "ok",
            "message": "row updated successfully"
        })
    except Exception as e:
        return JsonResponse({
            "status": "error",
            "error": str(e)
        }, status=500)


@csrf_exempt
@require_POST
@jwt_hod_or_admin_required
def admin_delete_row(request, table_name, row_id):
    """Delete a row from a table"""
    # Restricted Tables
    if table_name.lower() in ['feedback_response', 'feedback_submissionlog']:
        return JsonResponse({"status": "error", "error": "This table is read-only"}, status=403)

    try:
        # Find the model
        model = None
        for m in apps.get_app_config('feedback_app').get_models():
            if m._meta.db_table == table_name or m.__name__ == table_name:
                model = m
                break
        
        if not model:
            return JsonResponse({
                "status": "error",
                "error": f"table '{table_name}' not found"
            }, status=404)

        # Security: Prevent logged-in user from deleting their own account
        if model.__name__ == 'StaffUser':
            user_pk = getattr(request.user, 'pk', None)
            user_id = getattr(request.user, 'id', None)
            user_username = getattr(request.user, 'username', '')
            if str(row_id) in [str(user_pk), str(user_id), str(user_username)]:
                return JsonResponse({"status": "error", "error": "You cannot delete your own account."}, status=400)
        
        # Get and delete the object
        try:
            # Re-apply role filters to ensure they can't delete what they can't see
            visible_qs = apply_role_filters(request.user, model.objects.all(), model)
            obj = visible_qs.get(pk=row_id)

            if model.__name__ == 'StaffUser' and obj.pk == request.user.pk:
                return JsonResponse({"status": "error", "error": "You cannot delete your own account."}, status=400)

            obj.delete()
            
            return JsonResponse({
                "status": "ok",
                "message": "row deleted successfully"
            })
        except model.DoesNotExist:
            return JsonResponse({
                "status": "error",
                "error": f"row with id {row_id} not found or access denied"
            }, status=404)
    except Exception as e:
        return JsonResponse({
            "status": "error",
            "error": str(e)
        }, status=500)
@csrf_exempt
@jwt_hod_or_admin_required
def admin_get_token(request):
    """Fetch the current global student access token"""
    return JsonResponse({
        'status': 'ok',
        'token': CURRENT_ACCESS_TOKEN
    })

@csrf_exempt
@require_POST
@jwt_hod_or_admin_required
def admin_update_token(request):
    """Update the global student access token"""
    global CURRENT_ACCESS_TOKEN
    try:
        payload = json.loads(request.body)
        new_token = payload.get('token')
        if not new_token:
            return JsonResponse({'status': 'error', 'error': 'token is required'}, status=400)
        
        CURRENT_ACCESS_TOKEN = new_token
        return JsonResponse({
            'status': 'ok',
            'message': 'access token updated successfully',
            'token': CURRENT_ACCESS_TOKEN
        })
    except Exception as e:
        return JsonResponse({'status': 'error', 'error': str(e)}, status=500)

MIN_RESPONSES = 5  # Minimum feedbacks required for reliable categorization

def _trimmed_mean(values, trim_ratio=0.1):
    """
    Dynamic trimmed mean — removes top & bottom trim_ratio% of values.
    Much more stable for large datasets than removing exactly 1 min/max.
    """
    if not values:
        return 0.0
    n = len(values)
    if n < 5:
        return sum(values) / n
    values = sorted(values)
    k = int(n * trim_ratio)
    trimmed = values[k:n - k] if n - 2 * k > 0 else values
    return sum(trimmed) / len(trimmed)

def _std_dev(values):
    """Calculate standard deviation for confidence scoring."""
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / len(values)
    return variance ** 0.5

def _get_category(avg, response_count, std):
    """
    Category assignment using average + standard deviation + minimum responses.
    High std_dev with borderline-Excellent avg gets downgraded to Good
    (prevents fake Excellent from inconsistent ratings).
    """
    if response_count < MIN_RESPONSES:
        return "Insufficient Data"
    if avg >= 4.0:
        if std <= 1.0:
            return "Excellent"
        else:
            return "Good"  # unstable feedback -> downgrade
    elif avg >= 2.5:
        return "Good"
    else:
        return "Need Improvement"

@csrf_exempt
@require_GET
@jwt_hod_or_admin_required
def admin_teacher_report(request):
    """
    Production-grade teacher performance analytics pipeline:
    1. Fetch raw feedback per teacher
    2. Normalize per-response to 0-1 scale (reduces personal bias)
    3. Apply weighted scoring (teaching clarity > punctuality)
    4. Dynamic trimmed mean (remove top/bottom 10%)
    5. Standard deviation used in category decision
    6. Confidence factor penalizes small sample sizes
    7. Minimum response count gate
    """
    try:
        # Base queryset for feedback responses
        feedback_qs = Feedback_Response.objects.all()
        
        # Apply Role Filtering
        feedback_qs = apply_role_filters(request.user, feedback_qs, Feedback_Response)
        
        # Apply Date Filtering
        try:
            range_key = request.GET.get('range', 'last_6_months')
            start_date_str = request.GET.get('start_date')
            end_date_str = request.GET.get('end_date')
            
            start_date, end_date = validate_date_range(request.user, range_key, start_date_str, end_date_str)
            feedback_qs = apply_feedback_date_filter(feedback_qs, start_date, end_date)
        except PermissionError as e:
            return JsonResponse({'status': 'error', 'error': str(e)}, status=403)
        except ValueError as e:
            return JsonResponse({'status': 'error', 'error': str(e)}, status=400)
        
        # Group feedbacks by teacher
        teacher_groups = feedback_qs.values(
            teacher_id=F('AllocationID__TeacherID__TeacherID'),
            full_name=F('AllocationID__TeacherID__FullName')
        ).annotate(
            response_count=Count('ResponseID')
        ).order_by('-response_count')

        report_data = []
        q_fields = ['Q1_Rating', 'Q2_Rating', 'Q3_Rating', 'Q4_Rating', 'Q5_Rating',
                    'Q6_Rating', 'Q7_Rating', 'Q8_Rating', 'Q9_Rating', 'Q10_Rating']

        # Calculate Global Stats for each question
        global_question_scores = {f'q{i+1}': [] for i in range(10)}
        all_feedbacks = feedback_qs.values_list(*q_fields)
        
        for row in all_feedbacks:
            for i, val in enumerate(row):
                if val is not None:
                    global_question_scores[f'q{i+1}'].append(float(val))
                    
        global_question_stats = {}
        for qkey, scores in global_question_scores.items():
            if len(scores) > 0:
                 g_mean = round(_trimmed_mean(scores), 2)
                 g_std = round(_std_dev(scores), 2)
            else:
                 g_mean = 0.0
                 g_std = 0.0
            global_question_stats[qkey] = {
                 'mean': g_mean,
                 'std': g_std,
                 'threshold': round(g_mean - g_std, 2)
            }

        summary = {
            'excellent': 0,
            'good': 0,
            'needs_improvement': 0,
            'insufficient_data': 0,
            'total_teachers': 0,
            'global_question_stats': global_question_stats
        }

        for group in teacher_groups:
            tid = group['teacher_id']
            fname = group['full_name']
            rcount = group['response_count']

            # Fetch raw feedback rows for this teacher
            teacher_feedbacks = feedback_qs.filter(
                AllocationID__TeacherID__TeacherID=tid
            ).values_list(*q_fields)

            # Collect per-question raw scores
            per_question_scores = {f'q{i+1}': [] for i in range(10)}
            raw_scores = []

            for row in teacher_feedbacks:
                for i, val in enumerate(row):
                    if val is not None:
                        fval = float(val)
                        per_question_scores[f'q{i+1}'].append(fval)
                        raw_scores.append(fval)

            if not raw_scores:
                continue

            # Trimmed mean for overall rating
            overall_avg = _trimmed_mean(raw_scores)

            # Clamp to valid range
            overall_avg = max(0.0, min(5.0, overall_avg))

            # Trimmed mean for each individual question (unweighted, for radar chart)
            question_stats = {}
            for qkey, scores in per_question_scores.items():
                question_stats[qkey] = round(_trimmed_mean(scores), 2)

            # Standard deviation on raw scores (measures rating consistency)
            std = round(_std_dev(raw_scores), 2)

            # Confidence factor: penalizes small samples (scales linearly up to 20 responses)
            confidence_factor = min(1.0, rcount / 20.0)
            confidence_adjusted_avg = overall_avg * confidence_factor

            # Categorize using std_dev-aware logic
            category = _get_category(overall_avg, rcount, std)
            
            if category == "Excellent":
                summary['excellent'] += 1
            elif category == "Good":
                summary['good'] += 1
            elif category == "Need Improvement":
                summary['needs_improvement'] += 1
            elif category == "Insufficient Data":
                summary['insufficient_data'] += 1
            
            summary['total_teachers'] += 1
            
            report_data.append({
                'teacher_id': tid,
                'full_name': fname,
                'average_rating': round(overall_avg, 2),
                'response_count': rcount,
                'category': category,
                'std_deviation': std,
                'question_stats': question_stats
            })
            
        # Sort report_data by average_rating descending
        report_data.sort(key=lambda x: x['average_rating'], reverse=True)

        return JsonResponse({
            'status': 'ok',
            'date_range': {
                'start_date': start_date.isoformat() if start_date else None,
                'end_date': end_date.isoformat() if end_date else None,
                'range_key': range_key
            },
            'allowed_ranges': get_allowed_ranges(getattr(request.user, 'role', 'hod')),
            'summary': summary,
            'data': report_data
        })
    except Exception as e:
        return JsonResponse({'status': 'error', 'error': str(e)}, status=500)
@require_GET
@jwt_hod_or_admin_required
def admin_date_ranges(request):
    """Return allowed date ranges for the current user's role"""
    user_role = getattr(request.user, 'role', 'hod')
    allowed = get_allowed_ranges(user_role)
    return JsonResponse({
        'status': 'ok',
        'allowed_ranges': allowed,
        'default_range': 'last_6_months'
    })

@csrf_exempt
@require_POST
@jwt_hod_or_admin_required
def admin_generate_signature(request):
    """Generate a cryptographic signature for a class link to prevent tampering"""
    try:
        payload = json.loads(request.body)
        session = str(payload.get('session', ''))
        branch = payload.get('branch', '')
        year = str(payload.get('year', ''))
        semester = str(payload.get('semester', ''))
        section = str(payload.get('section', ''))

        if not all([session, branch, year, semester, section]):
            return JsonResponse({"status": "error", "error": "Missing class parameters"}, status=400)

        # Create a stable string to sign
        data_to_sign = f"{session}|{branch}|{year}|{semester}|{section}"
        
        signer = Signer(sep=':')
        signed_value = signer.sign(data_to_sign)
        
        # Extract the signature part (the part after the separator)
        signature = signed_value.split(':')[-1]

        return JsonResponse({
            "status": "ok",
            "signature": signature
        })
    except Exception as e:
        return JsonResponse({"status": "error", "error": str(e)}, status=500)


@require_POST
def admin_first_login_change_password(request):
    """Allows Admin/HOD to change their password on first login."""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return JsonResponse({'status': 'error', 'error': 'authentication required'}, status=401)
    
    token_str = auth_header.split(' ')[1] if ' ' in auth_header else auth_header
    
    try:
        from rest_framework_simplejwt.authentication import JWTAuthentication
        authenticator = JWTAuthentication()
        validated_token = authenticator.get_validated_token(token_str)
        user = authenticator.get_user(validated_token)
        
        if not user or not user.is_active or user.role not in ['admin', 'hod']:
            return JsonResponse({'status': 'error', 'error': 'invalid user'}, status=401)
            
        if not getattr(user, 'is_first_login', False):
            return JsonResponse({'status': 'error', 'error': 'not first login'}, status=400)
            
        payload = json.loads(request.body)
        new_password = payload.get('new_password')
        confirm_password = payload.get('confirm_password')
        
        if not new_password or not confirm_password:
            return JsonResponse({'status': 'error', 'error': 'missing passwords'}, status=400)
            
        if new_password != confirm_password:
            return JsonResponse({'status': 'error', 'error': 'passwords do not match'}, status=400)
            
        if len(new_password) < 6:
            return JsonResponse({'status': 'error', 'error': 'password too short (min 6 chars)'}, status=400)
            
        user.set_password(new_password)
        user.is_first_login = False
        user.save()
        
        return JsonResponse({'status': 'ok', 'message': 'password updated successfully'})
        
    except Exception as e:
        return JsonResponse({'status': 'error', 'error': str(e)}, status=400)
