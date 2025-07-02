import re
from datetime import datetime



class AISDecoder:
    def __init__(self):
        self.message_fragments = {}
        
    def parse_nmea_message(self, message):
        """Parse NMEA AIS message and extract basic information"""
        try:
            message = message.strip()
            
            if not message.startswith('!'):
                return None
                
            parts = message.split(',')
            if len(parts) < 6:
                return None
                
            talker_id = parts[0][1:3] 
            sentence_type = parts[0][3:] 
            fragment_count = int(parts[1]) if parts[1] else 1
            fragment_number = int(parts[2]) if parts[2] else 1
            message_id = parts[3] if parts[3] else None
            channel = parts[4]
            data = parts[5]
            
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
                'timestamp': datetime.now().isoformat(),
                'is_complete': fragment_count == 1 or self._is_message_complete(message_id, fragment_number, fragment_count)
            }
        except Exception as e:
            return None
    
    def _is_message_complete(self, message_id, fragment_number, fragment_count):
        """Check if multi-fragment message is complete"""
        if not message_id or fragment_count == 1:
            return True
            
        if message_id not in self.message_fragments:
            self.message_fragments[message_id] = set()
        
        self.message_fragments[message_id].add(fragment_number)
        
        expected_fragments = set(range(1, fragment_count + 1))
        is_complete = self.message_fragments[message_id] == expected_fragments
        
        if is_complete:
            del self.message_fragments[message_id]
            
        return is_complete
    
    def get_ais_message_type(self, data):
        """Extract AIS message type from the 6-bit ASCII data"""
        try:
            if not data:
                return None
                
            first_char = data[0]
            if first_char in '0123456789:;<=>?':
                val = ord(first_char) - ord('0')
            elif first_char in '@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_':
                val = ord(first_char) - ord('@') + 16
            else:
                return None
                
            msg_type = val & 0x3F
            return msg_type
        except:
            return None
    
    def validate_checksum(self, message):
        """Validate NMEA checksum"""
        try:
            if '*' not in message:
                return False
                
            msg_part, checksum = message.split('*')
            msg_part = msg_part[1:]  # Remove leading !
            
            calculated = 0
            for char in msg_part:
                calculated ^= ord(char)
                
            expected = int(checksum, 16)
            return calculated == expected
        except:
            return False
    
    def parse(self, message_text):
        """Main parsing method - returns parsed AIS message info"""
        parsed = self.parse_nmea_message(message_text)
        
        if not parsed:
            return None
            
        # Add additional parsing results
        parsed['ais_message_type'] = self.get_ais_message_type(parsed['data'])
        parsed['checksum_valid'] = self.validate_checksum(message_text)
        
        return parsed