import requests
from bs4 import BeautifulSoup
import json
import time
from typing import Dict, Optional

class VesselFinderScraper:
    def __init__(self):
        self.base_url = "https://www.vesselfinder.com/vessels/details/"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        })

    def scrape_vessel_data(self, imo_number: str) -> Optional[Dict]:
        url = f"{self.base_url}{imo_number}"
        
        try:
            response = self.session.get(url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            vessel_data = self._extract_vessel_info(soup)
            vessel_data['imo'] = imo_number
            vessel_data['source_url'] = url
            
            return vessel_data
            
        except requests.RequestException as e:
            print(f"Error fetching data for IMO {imo_number}: {e}")
            return None
        except Exception as e:
            print(f"Error parsing data for IMO {imo_number}: {e}")
            return None

    def _extract_vessel_info(self, soup: BeautifulSoup) -> Dict:
        vessel_data = {}

        try:
            title_tag = soup.find('h1', class_='title')
            if title_tag:
                vessel_data['Vessel Name'] = title_tag.get_text(strip=True)

            vst_tag = soup.find('h2', class_='vst')
            if vst_tag:
                vessel_data['IMO / MMSI'] = vst_tag.get_text(
                    strip=True).replace('Passenger Ship, ', '')

            main_photo_img = soup.find('img', class_='main-photo')
            if main_photo_img and 'src' in main_photo_img.attrs:
                vessel_data['Image'] = main_photo_img['src']

            particulars_sections = soup.find_all('table', class_='tpt1')
            for table in particulars_sections:
                for row in table.find_all('tr'):
                    cols = row.find_all('td')
                    if len(cols) == 2:
                        key = cols[0].get_text(strip=True)
                        value = cols[1].get_text(strip=True)
                        if value == '\u200b': 
                            value = 'N/A'
                        vessel_data[key] = value


        except Exception as e:
            print(f"An error occurred during parsing: {e}")
            return {} 

        return vessel_data

def main():
    scraper = VesselFinderScraper()
    
    imo_number = "9359997"
    
    print(f"Scraping vessel data for IMO: {imo_number}")
    vessel_data = scraper.scrape_vessel_data(imo_number)
    
    if vessel_data:
        print("Scraped data:")
        print(json.dumps(vessel_data, indent=2))
        
    else:
        print("Failed to scrape vessel data")

if __name__ == "__main__":
    main()