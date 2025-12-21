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
        'format': 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio[ext=opus]/bestaudio/best',
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
        # Anti-bot measures
        'geo_bypass': True,
        'geo_bypass_country': 'US',
        # Retry options
        'retries': 3,
        'fragment_retries': 3,
        # User agent to avoid blocks
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        # YouTube specific options to bypass age-gate and other restrictions
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web'],
            }
        }
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Extract info
            info = ydl.extract_info(url, download=True)
            
            title = sanitize_filename(info.get('title', 'Unknown Title'))
            artist = info.get('uploader', 'Unknown Artist')
            thumbnail_url = info.get('thumbnail', '')
            duration = info.get('duration', 0)
            
            # Find the downloaded file - yt-dlp downloads in native format (m4a, webm, opus)
            # NOT mp3 since we're not using FFmpeg conversion
            final_path = None
            pattern = os.path.join(output_dir, f"{unique_base}.*")
            matches = glob.glob(pattern)
            
            # Filter out any partial/temp files - include .mp4 as yt-dlp may use it
            audio_extensions = ['.m4a', '.webm', '.opus', '.mp3', '.ogg', '.aac', '.mp4']
            for match in matches:
                ext = os.path.splitext(match)[1].lower()
                if ext in audio_extensions and os.path.exists(match):
                    final_path = match
                    break
            
            if not final_path or not os.path.exists(final_path):
                # Debug: list what files exist
                all_matches = glob.glob(pattern)
                return {
                    'success': False,
                    'error': f'Download completed but file not found. Pattern: {pattern}, Matches: {all_matches}'
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
