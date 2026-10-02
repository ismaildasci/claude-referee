import unittest

from linediff import diff_lines


class Test(unittest.TestCase):
    def test_same_and_empty(self):
        self.assertEqual(diff_lines(["a", "b"], ["a", "b"]), [("=", "a"), ("=", "b")])
        self.assertEqual(diff_lines([], []), [])
        self.assertEqual(diff_lines([], ["x"]), [("+", "x")])
        self.assertEqual(diff_lines(["x"], []), [("-", "x")])

    def test_insert_and_delete(self):
        self.assertEqual(diff_lines(["a", "b", "c"], ["a", "c"]), [("=", "a"), ("-", "b"), ("=", "c")])
        self.assertEqual(diff_lines(["a", "c"], ["a", "b", "c"]), [("=", "a"), ("+", "b"), ("=", "c")])

    def test_replace(self):
        self.assertEqual(diff_lines(["a", "b", "c"], ["a", "x", "c"]), [("=", "a"), ("-", "b"), ("+", "x"), ("=", "c")])


if __name__ == "__main__":
    unittest.main()
