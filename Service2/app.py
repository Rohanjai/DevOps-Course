from fastapi import FastAPI, Response, HTTPException
import httpx
import time
import datetime
import shutil
import asyncio
from pathlib import Path
from typing import Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
PORT = 5050
LOG_FILE = Path('/vStorage')
STORAGE_URL = 'http://storage:5000/log'
REQUEST_TIMEOUT = 2.0

# Global variables
app = FastAPI(title="Service 2", description="Timestamp and logging service")
start_time = time.time()

class TimestampService:
    """Service for generating timestamps and managing logs"""
    
    def __init__(self, log_file: Path):
        self.log_file = log_file
        
    def get_timestamp2(self) -> str:
        """
        Generate a timestamp record with system information
        
        Returns:
            str: Formatted timestamp record
        """
        try:
            uptime_hours = f"{(time.time() - start_time) / 3600:.2f}"
            
            # Get disk usage information
            total, used, free = shutil.disk_usage('/')
            free_mb = round(free / (1024 * 1024))
            
            # Generate ISO timestamp
            timestamp = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'
            
            return f"Timestamp2: {timestamp}: uptime {uptime_hours} hours, free disk in root: {free_mb} MBytes"
            
        except Exception as e:
            logger.error(f"Error generating timestamp: {e}")
            raise HTTPException(status_code=500, detail="Error generating timestamp")
    
    def log_to_vstorage(self, record: str) -> None:
        """
        Write record to local volume storage
        
        Args:
            record: The record to write
            
        Raises:
            HTTPException: If writing to storage fails
        """
        try:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write(record + '\n')
        except Exception as e:
            logger.error(f"Error writing to volume storage: {e}")
            raise HTTPException(status_code=500, detail="Error writing to storage")
    
    async def post_to_storage(self, record: str) -> None:
        """
        Post record to storage service asynchronously
        
        Args:
            record: The record to post
        """
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                await client.post(
                    STORAGE_URL,
                    content=record,
                    headers={'Content-Type': 'text/plain'}
                )
        except Exception as e:
            logger.warning(f"Could not POST to Storage: {e}")
            # Don't raise exception here to avoid blocking the response

# Initialize service
timestamp_service = TimestampService(LOG_FILE)

@app.get("/status", response_class=Response)
async def get_status():
    """
    Generate timestamp record and log it to storage services
    
    Returns:
        Response: Plain text timestamp record
    """
    try:
        # Generate timestamp record
        ts2 = timestamp_service.get_timestamp2()
        
        # Post to storage service (non-blocking)
        await timestamp_service.post_to_storage(ts2)
        
        # Write to local volume storage
        timestamp_service.log_to_vstorage(ts2)
        
        return Response(content=ts2, media_type="text/plain")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in /status endpoint: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)