from pyais.stream import TCPConnection

host = '153.44.253.27'
port = 5631

for msg in TCPConnection(host, port=port):
    decoded_message = msg.decode()
    ais_content = decoded_message

    print('*' * 80)
    if msg.tag_block:
        # decode & print the tag block if it is available
        msg.tag_block.init()
        print(msg.tag_block.asdict())

    print(ais_content)
