import unittest

from natsort import natural_sorted


class Test(unittest.TestCase):
    def test_numbers(self):
        self.assertEqual(natural_sorted(["img12.png", "img10.png", "img2.png", "img1.png"]), ["img1.png", "img2.png", "img10.png", "img12.png"])

    def test_case(self):
        self.assertEqual(natural_sorted(["Banana", "apple", "cherry"]), ["apple", "Banana", "cherry"])

    def test_empty(self):
        self.assertEqual(natural_sorted([]), [])


if __name__ == "__main__":
    unittest.main()
