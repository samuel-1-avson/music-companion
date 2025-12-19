#!/usr/bin/env python3
"""
YouTube Audio Download Script
Called by Node.js backend to download audio using yt-dlp
Based on main.py's download_youtube_audio_sync function
"""

import sys
import os
import json
import time
import glob
import re
import yt_dlp

def sanitize_filename(name: str) -> str:
    """Remove or replace characters not allowed in filenames."""
    return re.sub(r'[\\/*?:"<>|]', '', name)

def download_audio(video_id: str, output_dir: str) -> dict:
    """
    Download audio from YouTube video.
    Returns JSON with success status, file path, and metadata.
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    # Create unique filename with timestamp
    timestamp = int(time.time() * 1000)
    unique_base = f"{video_id}_{timestamp}"
    output_template = os.path.join(output_dir, f"{unique_base}.%(ext)s")
    
    ydl_opts = {
        # Download best audio format directly (no FFmpeg conversion needed)
        'format': 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best',
        'outtmpl': output_template,
        # Completely suppress all console output
        'quiet': True,
        'no_warnings': True,
        'noprogress': True,
        'logger': None,  # No logging at all
        'progress_hooks': [],  # No progress callbacks
        'noplaylist': True,
        'restrictfilenames': True,
        # Rate limiting (polite to YouTube)
        'sleep_interval': 1,
        'sleep_interval_requests': 1,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Extract info
            info = ydl.extract_info(url, download=True)
            
            title = sanitize_filename(info.get('title', 'Unknown Title'))
            artist = info.get('uploader', 'Unknown Artist')
            thumbnail_url = info.get('thumbnail', '')
            duration = info.get('duration', 0)
            
            # Find the downloaded file
            expected_path = os.path.join(output_dir, f"{unique_base}.mp3")
            final_path = None
            
            if os.path.exists(expected_path):
                final_path = expected_path
            else:
                # Fallback: search for file
                pattern = os.path.join(output_dir, f"{unique_base}*")
                matches = glob.glob(pattern)
                if matches:
                    final_path = matches[0]
            
            if not final_path or not os.path.exists(final_path):
                return {
                    'success': False,
                    'error': 'Download completed but file not found'
                }
            
            # Check file size (50MB limit)
            file_size = os.path.getsize(final_path)
            if file_size > 50 * 1024 * 1024:
                os.remove(final_path)
                return {
                    'success': False,
                    'error': f'File exceeds 50MB limit ({file_size / (1024*1024):.2f}MB)'
                }
            
            return {
                'success': True,
                'filePath': final_path,
                'title': title,
                'artist': artist,
                'thumbnailUrl': thumbnail_url,
                'duration': duration,
                'fileSize': file_size
            }
            
    except yt_dlp.utils.DownloadError as de:
        error_msg = str(de)
        if 'Unsupported URL' in error_msg:
            return {'success': False, 'error': 'Unsupported URL'}
        elif 'Video unavailable' in error_msg or 'not available' in error_msg:
            return {'success': False, 'error': 'Video unavailable'}
        elif 'Private video' in error_msg:
            return {'success': False, 'error': 'Private video'}
        elif 'Premiere' in error_msg:
            return {'success': False, 'error': 'Cannot download Premieres'}
        elif '429' in error_msg:
            return {'success': False, 'error': 'Rate limited by YouTube'}
        else:
            return {'success': False, 'error': error_msg[:100]}
            
    except Exception as e:
        return {'success': False, 'error': str(e)[:100]}

def main():
    if len(sys.argv) < 3:
        print(json.dumps({'success': False, 'error': 'Usage: download.py <video_id> <output_dir>'}))
        sys.exit(1)
    
    video_id = sys.argv[1]
    output_dir = sys.argv[2]
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    result = download_audio(video_id, output_dir)
    print(json.dumps(result))

if __name__ == '__main__':
    main()
