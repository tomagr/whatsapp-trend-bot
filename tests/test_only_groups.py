import os
import unittest

from trendbot import store


class OnlyGroupsTest(unittest.TestCase):
    """TRENDBOT_ONLY limits a run to some groups ("Update" on one group in /admin)."""

    def tearDown(self):
        os.environ.pop("TRENDBOT_ONLY", None)

    def test_all_groups_by_default(self):
        self.assertEqual([c["key"] for c in store.groups()], ["overland", "sombreros", "members", "briefings", "moves"])

    def test_only_the_listed_groups(self):
        os.environ["TRENDBOT_ONLY"] = "members, overland"
        self.assertEqual([c["key"] for c in store.groups()], ["overland", "members"])

    def test_unknown_group_fails_instead_of_running_nothing(self):
        os.environ["TRENDBOT_ONLY"] = "nope"
        with self.assertRaises(ValueError):
            store.groups()


if __name__ == "__main__":
    unittest.main()
