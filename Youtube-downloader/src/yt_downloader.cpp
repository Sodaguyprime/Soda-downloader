#include <iostream>
#include <cstdlib>
#include <string>
#include <vector>
#include <fstream>
#include <sstream>

std::string runCommand(const std::string& command) {
    std::string result;
    char buffer[128];

    FILE* pipe = popen(command.c_str(), "r");
    if (!pipe) return "ERROR";

    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        result += buffer;
    }

    pclose(pipe);
    return result;
}

void fetchQualities(const std::string& videoUrl) {
    std::string command = "yt-dlp -J " + videoUrl + " --no-playlist";
    std::string output = runCommand(command);

    if (output.empty()) {
        std::cerr << "Error fetching qualities" << std::endl;
        return;
    }

    // Save JSON response to a file (optional)
    std::ofstream outFile("qualities.json");
    outFile << output;
    outFile.close();

    std::cout << output << std::endl;
}

void downloadVideo(const std::string& videoUrl, const std::string& savePath, bool isAudio, const std::string& quality) {
    std::string format = isAudio ? "bestaudio/best" : "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]";
    
    if (!quality.empty()) {
        format = quality + "+bestaudio/best";  // Download specific quality
    }

    std::string command = "yt-dlp -o \"" + savePath + "/%(title)s.%(ext)s\" -f \"" + format + "\" \"" + videoUrl + "\"";
    std::cout << "Downloading with command: " << command << std::endl;

    int result = std::system(command.c_str());

    if (result != 0) {
        std::cerr << "Download failed" << std::endl;
    } else {
        std::cout << "Download complete!" << std::endl;
    }
}

void downloadPlaylist(const std::string& playlistUrl, const std::string& savePath) {
    std::string command = "yt-dlp -o \"" + savePath + "/%(playlist_title)s/%(title)s.%(ext)s\" -f \"bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]\" \"" + playlistUrl + "\"";
    
    std::cout << "Downloading playlist with command: " << command << std::endl;
    int result = std::system(command.c_str());

    if (result != 0) {
        std::cerr << "Playlist download failed" << std::endl;
    } else {
        std::cout << "Playlist download complete!" << std::endl;
    }
}

int main(int argc, char* argv[]) {
    if (argc < 3) {
        std::cerr << "Usage: yt_downloader <fetch/download> <YouTube_URL> [save_path] [audio] [quality]" << std::endl;
        return 1;
    }

    std::string mode = argv[1];
    std::string videoUrl = argv[2];
    std::string savePath = (argc > 3) ? argv[3] : "./Downloads";
    bool isAudio = (argc > 4) ? (std::string(argv[4]) == "true") : false;
    std::string quality = (argc > 5) ? argv[5] : "";

    if (mode == "fetch") {
        fetchQualities(videoUrl);
    } else if (mode == "download") {
        if (videoUrl.find("playlist?") != std::string::npos) {
            downloadPlaylist(videoUrl, savePath);
        } else {
            downloadVideo(videoUrl, savePath, isAudio, quality);
        }
    } else {
        std::cerr << "Invalid mode. Use 'fetch' or 'download'" << std::endl;
        return 1;
    }

    return 0;
}
