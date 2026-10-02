import unittest

from movavg import moving_average


class Test(unittest.TestCase):
    def test_basic(self):
        self.assertEqual(moving_average([1, 2, 3, 4], 2), [1.0, 1.5, 2.5, 3.5])
        self.assertEqual(moving_average([2, 4, 6], 3), [2.0, 3.0, 4.0])

    def test_window_one_and_empty(self):
        self.assertEqual(moving_average([5, 6], 1), [5.0, 6.0])
        self.assertEqual(moving_average([], 3), [])

    def test_bad_window(self):
        with self.assertRaises(ValueError):
            moving_average([1], 0)


if __name__ == "__main__":
    unittest.main()
