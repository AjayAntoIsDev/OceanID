#!/usr/bin/env python3
"""
TCP to UDP Relay Script
Connects to a TCP server and relays all received messages to a UDP server on localhost.
"""

import socket
import threading
import time
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TCPToUDPRelay:
    def __init__(self, tcp_host='153.44.253.27', tcp_port=5631, udp_host='localhost', udp_port=1234):
        self.tcp_host = tcp_host
        self.tcp_port = tcp_port
        self.udp_host = udp_host
        self.udp_port = udp_port
        self.running = False
        self.tcp_socket = None
        self.udp_socket = None
        
    def setup_udp_socket(self):
        """Create and configure UDP socket for sending messages"""
        try:
            self.udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            logger.info(f"UDP socket created for relaying to {self.udp_host}:{self.udp_port}")
            return True
        except Exception as e:
            logger.error(f"Failed to create UDP socket: {e}")
            return False
    
    def connect_tcp(self):
        """Connect to the TCP server"""
        try:
            self.tcp_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.tcp_socket.settimeout(10)  # 10 second timeout
            self.tcp_socket.connect((self.tcp_host, self.tcp_port))
            logger.info(f"Connected to TCP server {self.tcp_host}:{self.tcp_port}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to TCP server: {e}")
            return False
    
    def relay_message(self, message):
        """Send message to UDP server"""
        try:
            if self.udp_socket:
                self.udp_socket.sendto(message, (self.udp_host, self.udp_port))
                logger.debug(f"Relayed {len(message)} bytes to UDP")
            else:
                logger.warning("UDP socket not available")
        except Exception as e:
            logger.error(f"Failed to relay message to UDP: {e}")
    
    def listen_tcp(self):
        """Listen for messages from TCP server and relay them"""
        buffer = b""
        
        while self.running:
            try:
                # Receive data from TCP server
                data = self.tcp_socket.recv(4096)
                if not data:
                    logger.warning("TCP connection closed by server")
                    break
                
                buffer += data
                logger.info(f"Received {len(data)} bytes from TCP server")
                
                # Process complete messages (assuming line-based protocol)
                while b'\n' in buffer:
                    line, buffer = buffer.split(b'\n', 1)
                    if line.strip():  # Only relay non-empty lines
                        message = line.strip() + b'\n'  # Add back the newline
                        self.relay_message(message)
                        logger.info(f"Message relayed: {message.decode('utf-8', errors='ignore').strip()}")
                
            except socket.timeout:
                continue
            except Exception as e:
                logger.error(f"Error receiving TCP data: {e}")
                break
    
    def start(self):
        """Start the relay service"""
        logger.info("Starting TCP to UDP relay service...")
        
        # Setup UDP socket
        if not self.setup_udp_socket():
            return False
        
        self.running = True
        
        while self.running:
            # Connect to TCP server
            if not self.connect_tcp():
                logger.warning("Retrying TCP connection in 5 seconds...")
                time.sleep(5)
                continue
            
            try:
                # Start listening for TCP messages
                self.listen_tcp()
            except KeyboardInterrupt:
                logger.info("Received interrupt signal")
                break
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
            
            # Clean up TCP connection
            if self.tcp_socket:
                self.tcp_socket.close()
                self.tcp_socket = None
            
            if self.running:
                logger.warning("TCP connection lost, retrying in 5 seconds...")
                time.sleep(5)
        
        self.stop()
        
    def stop(self):
        """Stop the relay service"""
        logger.info("Stopping TCP to UDP relay service...")
        self.running = False
        
        if self.tcp_socket:
            self.tcp_socket.close()
            self.tcp_socket = None
        
        if self.udp_socket:
            self.udp_socket.close()
            self.udp_socket = None
        
        logger.info("Relay service stopped")


def main():
    """Main function to run the relay"""
    relay = TCPToUDPRelay(
        tcp_host='153.44.253.27',
        tcp_port=5631,
        udp_host='localhost',
        udp_port=1234
    )
    
    try:
        relay.start()
    except KeyboardInterrupt:
        logger.info("Received Ctrl+C, shutting down...")
        relay.stop()


if __name__ == "__main__":
    main()
