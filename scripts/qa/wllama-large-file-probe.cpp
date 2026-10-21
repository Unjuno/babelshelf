// Boundary probe for the real async fread wrapper, not model inference.
#include <cstdio>
#include <cstdlib>
#include <cstdint>
#include <string>
#include <sys/types.h>
#include "wllama-fs.h"

extern "C" int probe_read(double position, int requested) {
    wllama_fs::ready = true;
    wllama_fs::use_async = true;
    FILE * f = fopen("/large.gguf", "rb");
    if (!f) return -1;
    if (fseeko(f, static_cast<off_t>(position), SEEK_SET)) { fclose(f); return -2; }
    std::vector<unsigned char> bytes(requested);
    int result = 1;
    // Repeated small reads exercise read-ahead cache and crossing 2 GiB.
    for (int read = 0; read < 2; ++read) {
        const size_t expected = std::min<size_t>(bytes.size(), 2310125920ull - static_cast<uint64_t>(position));
        const size_t n = fread(bytes.data(), 1, bytes.size(), f);
        if (n != expected) { result = -3; break; }
        for (size_t i = 0; i < n; ++i)
            if (bytes[i] != static_cast<unsigned char>(static_cast<uint64_t>(position) + i)) { result = -4; break; }
        position += expected;
        if (ftello(f) != static_cast<off_t>(position)) result = -5;
        if (result != 1) break;
    }
    fclose(f);
    return result;
}

extern "C" int probe_overflow() {
    wllama_fs::ready = true;
    wllama_fs::use_async = true;
    FILE * f = fopen("/large.gguf", "rb");
    if (!f) return -1;
    unsigned char bytes[32];
    if (fread(bytes, 1, 8, f) != 8) { fclose(f); return -2; }
    if (fseeko(f, 0xfffffff0ull, SEEK_SET)) { fclose(f); return -3; }
    // Must refuse before cache arithmetic wraps or any async read occurs.
    const size_t n = fread(bytes, 1, sizeof(bytes), f);
    const auto position = ftello(f);
    fclose(f);
    return n == 0 && position == 0xfffffff0ull ? 1 : -4;
}
