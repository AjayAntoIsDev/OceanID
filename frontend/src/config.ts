interface AppConfig {
  api: {
    baseUrl: string;
    endpoints: {
      ships: string;
      shipsInArea: string;
      shipsCount: string;
      shipData: string;
    };
  };
  map: {
    defaultCenter: {
      lat: number;
      lon: number;
    };
    defaultZoom: number;
    refreshInterval: number;
    zoomToRadiusMapping: { [key: number]: number };
  };
  ui: {
    theme: string;
    showInfoModalOnLoad: boolean;
  };
  external: {
    flagApiUrl: string;
    tileLayerUrl: string;
    tileLayerAttribution: string;
  };
}

const config: AppConfig = {
  api: {
    baseUrl: "https://oceanid-backend.ajayanto.me",
    endpoints: {
      ships: "/ships/",
      shipsInArea: "/ships/in-area",
      shipsCount: "/ships/count",
      shipData: "/ship/data"
    }
  },
  map: {
    defaultCenter: {
      lat: 59.9139,
      lon: 10.7522
    },
    defaultZoom: 10,
    refreshInterval: 5000,
    zoomToRadiusMapping: {
      1: 3000,
      2: 2500,
      3: 2000,
      4: 1500,
      5: 1000,
      6: 700,
      7: 500,
      8: 300,
      9: 200,
      10: 150,
      11: 100,
      12: 70,
      13: 50,
      14: 30,
      15: 20,
      16: 15,
      17: 10,
      18: 7,
      19: 5,
      20: 3,
    }
  },
  ui: {
    theme: "lemonade",
    showInfoModalOnLoad: true
  },
  external: {
    flagApiUrl: "https://restcountries.com/v3.1/name",
    tileLayerUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    tileLayerAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }
};

export default config;
