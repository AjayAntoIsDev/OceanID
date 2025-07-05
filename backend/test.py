import requests

# The URL for the vessel details page
url = "https://www.vesselfinder.com/vessels/details/9359997"

# The headers you want to use
headers = {
    "User-Agent": "def not scraping your data",
}

try:
    # Make the GET request with the specified headers
    response = requests.get(url, headers=headers)

    # Check if the request was successful (status code 200)
    if response.status_code == 200:
        # Print the raw HTML content of the response
        print("Successfully retrieved the HTML content.")
        # Print first 1000 characters to avoid flooding console
        print(response.text)
        # You can save response.text to a file or parse it further with BeautifulSoup
    else:
        print(
            f"Failed to retrieve the page. Status code: {response.status_code}")
        print(response.text)  # Print error content if available

except requests.exceptions.RequestException as e:
    print(f"An error occurred: {e}")
