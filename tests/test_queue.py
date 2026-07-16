import unittest
import datetime
from backend.services.queue_service import calculate_priority_score

class TestQueueService(unittest.TestCase):
    
    def test_priority_scores_and_aging(self):
        now = datetime.datetime.utcnow()
        
        # Case A: Normal patient (Priority 3) checked in 40 mins ago
        # Score = 40 + 0 = 40
        time_a = now - datetime.timedelta(minutes=40)
        score_a = calculate_priority_score(time_a, priority_level=3)
        self.assertAlmostEqual(score_a, 40.0, places=1)
        
        # Case B: Critical patient (Priority 1) checked in 2 mins ago
        # Score = 2 + 120 = 122
        time_b = now - datetime.timedelta(minutes=2)
        score_b = calculate_priority_score(time_b, priority_level=1)
        self.assertAlmostEqual(score_b, 122.0, places=1)
        
        # Critical patient should have higher score than the normal patient who waited 40 mins
        self.assertTrue(score_b > score_a)
        
        # Case C: Normal patient (Priority 3) checked in 130 mins ago (starvation prevention / aging)
        # Score = 130 + 0 = 130
        time_c = now - datetime.timedelta(minutes=130)
        score_c = calculate_priority_score(time_c, priority_level=3)
        self.assertAlmostEqual(score_c, 130.0, places=1)
        
        # Aged normal patient (score 130) should now move ahead of the new critical patient (score 122)
        # maintaining fairness!
        self.assertTrue(score_c > score_b)
        
        # Case D: Urgent patient (Priority 2) checked in 10 mins ago
        # Score = 10 + 30 = 40
        time_d = now - datetime.timedelta(minutes=10)
        score_d = calculate_priority_score(time_d, priority_level=2)
        self.assertAlmostEqual(score_d, 40.0, places=1)
        
        # Urgent patient (score 40) is equal to normal patient waiting 40 mins (score 40)
        self.assertAlmostEqual(score_d, score_a, places=1)

if __name__ == "__main__":
    unittest.main()
