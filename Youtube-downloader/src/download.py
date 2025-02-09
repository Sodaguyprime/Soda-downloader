import yt_dlp
import sys
import json
import os
from pathlib import Path

def ensure_download_directory(path):
    """Ensure the download directory exists"""
    Path(path).mkdir(parents=True, exist_ok=True)
    return path

def get_video_qualities(video_url):
    """Get all available video qualities with improved format detection"""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            formats = info.get('formats', [])
            
            # Filter and organize formats
            video_formats = []
            for f in formats:
                # Get formats with video (excluding audio-only)
                if f.get('vcodec') != 'none':
                    format_info = {
                        'format_id': f.get('format_id'),
                        'ext': f.get('ext'),
                        'format_note': f.get('format_note', ''),
                        'filesize': f.get('filesize', 0),
                        'width': f.get('width', 0),
                        'height': f.get('height', 0),
                        'vcodec': f.get('vcodec', ''),
                        'acodec': f.get('acodec', ''),
                        'fps': f.get('fps', 0)
                    }
                    video_formats.append(format_info)
            
            # Sort by quality (height)
            video_formats.sort(key=lambda x: (x['height'], x['filesize']), reverse=True)
            
            # Add video title and duration to response
            response = {
                'title': info.get('title', ''),
                'duration': info.get('duration', 0),
                'formats': video_formats
            }
            
            print(json.dumps(response))
            return 0
            
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        return 1

def download_video(video_url, download_path, is_audio=False, quality=None, with_audio=True):
    """Download video with enhanced options"""
    try:
        # Ensure download directory exists
        ensure_download_directory(download_path)
        
        # Base options
        ydl_opts = {
            'paths': {'home': download_path},
            'progress_hooks': [progress_hook],
            'outtmpl': os.path.join(download_path, '%(title)s.%(ext)s'),
        }
        
        if is_audio:
            # Audio-only download options
            ydl_opts.update({
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            })
        else:
            # Video download options
            if quality and not with_audio:
                # Download specific quality without audio
                ydl_opts['format'] = f'{quality}/bestvideo[ext=mp4]'
            elif quality and with_audio:
                # Download specific quality with audio
                ydl_opts['format'] = f'{quality}+bestaudio[ext=m4a]/best[ext=mp4]'
            else:
                # Default to best quality
                ydl_opts['format'] = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]'
            
            # Always prefer MP4 container
            ydl_opts['merge_output_format'] = 'mp4'
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])
        return 0
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        return 1

def progress_hook(d):
    """Enhanced progress hook with more detailed information"""
    if d['status'] == 'downloading':
        progress = d.get('_percent_str', '0%').strip()
        speed = d.get('_speed_str', '?')
        eta = d.get('_eta_str', '?')
        
        progress_info = {
            'progress': progress,
            'speed': speed,
            'eta': eta,
            'filename': d.get('filename', ''),
            'total_bytes': d.get('total_bytes', 0),
            'downloaded_bytes': d.get('downloaded_bytes', 0)
        }
        
        print(json.dumps(progress_info), flush=True)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("No URL provided", file=sys.stderr)
        sys.exit(1)
    
    video_url = sys.argv[1]
    
    if len(sys.argv) > 2 and sys.argv[2] == '--get-qualities':
        sys.exit(get_video_qualities(video_url))
    
    # Parse arguments
    download_path = sys.argv[2] if len(sys.argv) > 2 else './Downloads'
    is_audio = sys.argv[3].lower() == 'true' if len(sys.argv) > 3 else False
    quality = sys.argv[4] if len(sys.argv) > 4 else None
    with_audio = sys.argv[5].lower() == 'true' if len(sys.argv) > 5 else True
    
    sys.exit(download_video(video_url, download_path, is_audio, quality, with_audio))