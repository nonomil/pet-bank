import importlib.util
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("generate_minecraft_vocab_audio.py")
SPEC = importlib.util.spec_from_file_location("minecraft_vocab_audio", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class VoxCpmLoadingTests(unittest.TestCase):
    def test_batch_loader_disables_torch_compile(self):
        options = MODULE.model_load_options("D:/HuggingFaceCache/VoxCPM2")
        self.assertEqual(options["device"], "cuda")
        self.assertFalse(options["optimize"])
        self.assertFalse(options["load_denoiser"])


if __name__ == "__main__":
    unittest.main()
