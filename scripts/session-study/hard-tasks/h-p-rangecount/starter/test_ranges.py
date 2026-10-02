import unittest

from ranges import count_between


class Test(unittest.TestCase):
    def test_half_open(self):
        values = [1, 3, 5, 7, 9]
        self.assertEqual(count_between(values, 3, 7), 2)
        self.assertEqual(count_between(values, 0, 100), 5)
        self.assertEqual(count_between(values, 10, 20), 0)

    def test_flags(self):
        values = [1, 3, 5, 7, 9]
        self.assertEqual(count_between(values, 3, 7, include_hi=True), 3)
        self.assertEqual(count_between(values, 3, 7, include_lo=False), 1)

    def test_empty(self):
        self.assertEqual(count_between([], 0, 1), 0)


if __name__ == "__main__":
    unittest.main()
