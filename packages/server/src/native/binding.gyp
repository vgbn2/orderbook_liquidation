{
  "targets": [{
    "target_name": "terminus_core",
    "cflags!":    ["-fno-exceptions"],
    "cflags_cc!": ["-fno-exceptions"],
    "sources": [
      "terminus_core.cpp",
      "orderbook.cpp",
      "aggregator.cpp",
      "vwaf.cpp",
      "wall_detector.cpp"
    ],
    "include_dirs": [
      "<!@(node -p \"require('node-addon-api').include\")"
    ],
    "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
    "cflags_cc": ["-std=c++17", "-O3", "-march=native"],
    "xcode_settings": {
      "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
      "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
      "OTHER_CFLAGS": ["-O3"]
    },
    "msvs_settings": {
      "VCCLCompilerTool": {
        "ExceptionHandling": 1,
        "AdditionalOptions": ["/std:c++17", "/O2"]
      }
    }
  }]
}
