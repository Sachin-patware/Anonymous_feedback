from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator, MaxLengthValidator

class Feedback_Response(models.Model):
    ResponseID = models.AutoField(primary_key=True)
    AllocationID = models.ForeignKey(
        "feedback_app.Academic_Allocation",
        db_column="AllocationID",
        on_delete=models.CASCADE,
    )
    Q1_Rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    Q2_Rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    Q3_Rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    Q4_Rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    Q5_Rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    Q6_Rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    Q7_Rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    Q8_Rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    Q9_Rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    Q10_Rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    Comments = models.CharField(max_length=500, blank=True, null=True, validators=[MaxLengthValidator(500)])

    class Meta:
        db_table = "feedback_response"
        managed = False
