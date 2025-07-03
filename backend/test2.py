from pyais.stream import TagBlockQueue
from pyais.queue import NMEAQueue
from pyais.stream import TCPConnection
from pyais import decode

host = '153.44.253.27'
port = 5631
# Initialize a TagBlockQueue
tbq = TagBlockQueue()

# Create an NMEAQueue instance
queue = NMEAQueue(tbq=tbq)

for msg in TCPConnection(host, port=port):
    decoded_message = msg.decode()
    ais_content = decoded_message

    queue.put_line(msg.raw)
    sentence = queue.get_or_none()
    if sentence:
        decoded_message = decode(sentence.raw)

    print(decoded_message)
    print('*' * 80)