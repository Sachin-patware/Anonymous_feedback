from rest_framework import serializers
from django.utils import timezone
from django import forms
from datetime import date
from feedback_app.models import Academic_Subject, Faculty_Teacher, Academic_Allocation, StaffUser


class LoginSerializer(forms.Form):
    REQUIRED_MSG = "All fields are required"
     
    session = forms.CharField(
        required=True,
        error_messages={'required': REQUIRED_MSG}
    )
    branch = forms.CharField(
        required=True,
        error_messages={'required': REQUIRED_MSG}
    )
    year = forms.IntegerField(
        required=True,
        error_messages={'required': REQUIRED_MSG}
    )
    semester = forms.IntegerField(
        required=True,
        error_messages={'required': REQUIRED_MSG}
    )
    section = forms.IntegerField(
        required=True,
        error_messages={'required': REQUIRED_MSG}
    )

    def clean_branch(self):
        branch = self.cleaned_data.get('branch', '').upper().strip()
        valid_branches = ['CSE', 'CSE(RL)', 'IT', 'CSE(DS)', 'CSE(CY)', 'CSIT', 'CSE(AIML)', 'ME', 'CE', 'EC', 'EC-ACT', 'EC-VLSI']
        if branch not in valid_branches:
            raise forms.ValidationError(f"Invalid branch. Must be one of: {', '.join(valid_branches)}")
        return branch
class FeedbackSerializer(forms.Form):

    subject_code = forms.CharField(
        required=True,
        max_length=50,
        error_messages={
            'required': 'subject_code is required',
            'max_length': 'subject_code must be at most 50 characters'
        }
    )

    allocation_id = forms.IntegerField(
        required=True,
        error_messages={
            'required': 'allocation_id is required',
            'invalid': 'allocation_id must be an integer'
        }
    )

    q1 = forms.IntegerField(min_value=1, max_value=5, required=True,
        error_messages={"required": "q1 is required", "min_value": "rating must be 1–5", "max_value": "rating must be 1–5"})
    q2 = forms.IntegerField(min_value=1, max_value=5, required=True,
        error_messages={"required": "q2 is required", "min_value": "rating must be 1–5", "max_value": "rating must be 1–5"})
    q3 = forms.IntegerField(min_value=1, max_value=5, required=True,
        error_messages={"required": "q3 is required", "min_value": "rating must be 1–5", "max_value": "rating must be 1–5"})
    q4 = forms.IntegerField(min_value=1, max_value=5, required=True,
        error_messages={"required": "q4 is required", "min_value": "rating must be 1–5", "max_value": "rating must be 1–5"})
    q5 = forms.IntegerField(min_value=1, max_value=5, required=True,
        error_messages={"required": "q5 is required", "min_value": "rating must be 1–5", "max_value": "rating must be 1–5"})
    q6 = forms.IntegerField(min_value=1, max_value=5, required=True,
        error_messages={"required": "q6 is required", "min_value": "rating must be 1–5", "max_value": "rating must be 1–5"})
    q7 = forms.IntegerField(min_value=1, max_value=5, required=True,
        error_messages={"required": "q7 is required", "min_value": "rating must be 1–5", "max_value": "rating must be 1–5"})
    q8 = forms.IntegerField(min_value=1, max_value=5, required=True,
        error_messages={"required": "q8 is required", "min_value": "rating must be 1–5", "max_value": "rating must be 1–5"})
    q9 = forms.IntegerField(min_value=1, max_value=5, required=True,
        error_messages={"required": "q9 is required", "min_value": "rating must be 1–5", "max_value": "rating must be 1–5"})
    q10 = forms.IntegerField(min_value=1, max_value=5, required=True,
        error_messages={"required": "q10 is required", "min_value": "rating must be 1–5", "max_value": "rating must be 1–5"})

    comments = forms.CharField(required=False, max_length=20)

    # --- Cleaners ---
    def clean_subject_code(self):
        value = self.cleaned_data.get("subject_code")
        return value.upper().strip() if value else value

    def clean_comments(self):
        value = self.cleaned_data.get("comments")
        return value.strip() if value else value

    def clean(self):
        return super().clean()


class AcademicSubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Academic_Subject
        fields = '__all__'

    def validate_SubjectCode(self, value):
        if not value.isalnum():
            raise serializers.ValidationError("Subject code must be alphanumeric.")
        return value.upper()

    def validate_Semester(self, value):
        if not (1 <= value <= 8):
            raise serializers.ValidationError("Semester must be between 1 and 8.")
        return value

    def validate_Branch(self, value):
        valid_branches = ['CSE', 'CSE(RL)', 'IT', 'CSE(DS)', 'CSE(CY)', 'CSIT', 'CSE(AIML)', 'ME', 'CE', 'EC', 'EC-ACT', 'EC-VLSI']
        if value.upper() not in valid_branches:
            raise serializers.ValidationError(f"Invalid branch. Must be one of: {', '.join(valid_branches)}")
        return value.upper()


class FacultyTeacherSerializer(serializers.ModelSerializer):
    class Meta:
        model = Faculty_Teacher
        fields = '__all__'

    def validate_TeacherID(self, value):
        if len(value) > 10:
            raise serializers.ValidationError("Teacher ID must be at most 10 characters.")
        return value.upper()


class AcademicAllocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Academic_Allocation
        fields = '__all__'
        read_only_fields = ['AllocationID']

    def validate_Target_Year(self, value):
        if not (1 <= value <= 4):
            raise serializers.ValidationError("Target year must be between 1 and 4.")
        return value

    def validate_Target_Semester(self, value):
        if not (1 <= value <= 8):
            raise serializers.ValidationError("Target semester must be between 1 and 8.")
        return value

    def validate_Target_Section(self, value):
        if not (1 <= value <= 10):
            raise serializers.ValidationError("Target section must be between 1 and 5.")
        return value

    def validate_AcademicSession(self, value):
        import re
        if not re.match(r'^[A-Z][a-z]{2}-[A-Z][a-z]{2} \d{4}$', value):
            raise serializers.ValidationError("Academic Session must be in the format 'MMM-MMM YYYY' (e.g., Jun-Dec 2026).")
        return value

class StaffUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffUser
        fields = ['id', 'username', 'password', 'role', 'department', 'branches', 'is_active', 'is_first_login']
        extra_kwargs = {
            'password': {'write_only': True, 'required': False}
        }

 

    def update(self, instance, validated_data):
        request = self.context.get('request')
        password = validated_data.pop('password', None)
        
        # Security: Only admins can change roles
        if request and hasattr(request, 'user') and request.user.role != 'admin':
            validated_data.pop('role', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            
        if password and password != "********":
            instance.set_password(password)
            
        instance.save()
        return instance
