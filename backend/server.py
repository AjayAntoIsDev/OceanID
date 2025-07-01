#!/usr/bin/env python3
"""
UDP Server to receive AIS messages from rtl_ais or test_sender
Listens on UDP port and processes incoming NMEA AIS messages
"""

import socket
import sys
import time
import threading
import argparse
from datetime import datetime
import json

class AISUDPServer:
    def __init__(self, host='0.0.0.0', port=10110, verbose=False):
        self.host = host
        self.port = port
        self.verbose = verbose
        self.running = False
        self.sock = None
        self.message_count = 0
        self.error_count = 0
        self.start_time = None
        
    def parse_nmea_message(self, message):
        """Parse NMEA AIS message and extract basic information"""
        try:
            # Remove any trailing whitespace/newlines
            message = message.strip()
            
            if not message.startswith('!'):
                return None
                
            # Split the message into parts
            parts = message.split(',')
            if len(parts) < 6:
                return None
                
            talker_id = parts[0][1:3]  # AI for AIS
            sentence_type = parts[0][3:]  # VDM for VHF Data-link Message
            fragment_count = int(parts[1]) if parts[1] else 1
            fragment_number = int(parts[2]) if parts[2] else 1
            message_id = parts[3]
            channel = parts[4]
            data = parts[5]
            
            # Extract checksum if present
            checksum = None
            if '*' in data:
                data, checksum_part = data.split('*')
                checksum = checksum_part
                
            return {
                'raw': message,
                'talker_id': talker_id,
                'sentence_type': sentence_type,
                'fragment_count': fragment_count,
                'fragment_number': fragment_number,
                'message_id': message_id,
                'channel': channel,
                'data': data,
                'checksum': checksum,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            if self.verbose:
                print(f"Error parsing message: {e}")
            return None
    
    def get_ais_message_type(self, data):
        """Extract AIS message type from the 6-bit ASCII data"""
        try:
            # Convert first character of 6-bit ASCII to get message type
            # This is a simplified extraction
            if not data:
                return None
                
            # 6-bit ASCII conversion (simplified)
            first_char = data[0]
            if first_char in '0123456789:;<=>?':
                val = ord(first_char) - ord('0')
            elif first_char in '@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_':
                val = ord(first_char) - ord('@') + 16
            else:
                return None
                
            # Message type is in bits 0-5 of the first 6 bits
            msg_type = val & 0x3F
            return msg_type
        except:
            return None
    
    def handle_message(self, data, addr):
        """Process received AIS message"""
        try:
            message = data.decode('utf-8', errors='ignore').strip()
            if not message:
                return
                
            self.message_count += 1
            
            # Parse the NMEA message
            parsed = self.parse_nmea_message(message)
            
            if parsed:
                msg_type = self.get_ais_message_type(parsed['data'])
                
                if self.verbose:
                    print(f"\n--- Message {self.message_count} from {addr[0]}:{addr[1]} ---")
                    print(f"Time: {parsed['timestamp']}")
                    print(f"Raw: {parsed['raw']}")
                    print(f"Channel: {parsed['channel']}")
                    print(f"Fragment: {parsed['fragment_number']}/{parsed['fragment_count']}")
                    if msg_type is not None:
                        print(f"AIS Message Type: {msg_type}")
                    print(f"Data length: {len(parsed['data'])} characters")
                else:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Msg {self.message_count}: "
                          f"Type {msg_type if msg_type else '?'} from {addr[0]}")
                
                # You can add more processing here:
                # - Store to database
                # - Forward to other systems
                # - Decode AIS payload
                # - Validate checksums
                
            else:
                self.error_count += 1
                if self.verbose:
                    print(f"Failed to parse message: {message}")
                    
        except Exception as e:
            self.error_count += 1
            if self.verbose:
                print(f"Error handling message: {e}")
    
    def start(self):
        """Start the UDP server"""
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.sock.bind((self.host, self.port))
            
            self.running = True
            self.start_time = time.time()
            
            print(f"AIS UDP Server listening on {self.host}:{self.port}")
            print("Press Ctrl+C to stop")
            
            while self.running:
                try:
                    # Set timeout so we can check running flag periodically
                    self.sock.settimeout(1.0)
                    data, addr = self.sock.recvfrom(1024)
                    self.handle_message(data, addr)
                    
                except socket.timeout:
                    continue
                except Exception as e:
                    if self.running:
                        print(f"Error receiving data: {e}")
                        
        except KeyboardInterrupt:
            print("\nShutting down server...")
        except Exception as e:
            print(f"Server error: {e}")
        finally:
            self.stop()
    
    def stop(self):
        """Stop the UDP server"""
        self.running = False
        if self.sock:
            self.sock.close()
            
        # Print statistics
        if self.start_time:
            duration = time.time() - self.start_time
            print(f"\nServer Statistics:")
            print(f"Duration: {duration:.1f} seconds")
            print(f"Messages received: {self.message_count}")
            print(f"Parse errors: {self.error_count}")
            if duration > 0:
                print(f"Messages per second: {self.message_count/duration:.2f}")

def main():
    parser = argparse.ArgumentParser(description='AIS UDP Message Receiver')
    parser.add_argument('-H', '--host', default='0.0.0.0',
                       help='Host to bind to (default: 0.0.0.0)')
    parser.add_argument('-p', '--port', type=int, default=10110,
                       help='Port to listen on (default: 10110)')
    parser.add_argument('-v', '--verbose', action='store_true',
                       help='Verbose output')
    
    args = parser.parse_args()
    
    server = AISUDPServer(args.host, args.port, args.verbose)
    server.start()

if __name__ == '__main__':
    main()
