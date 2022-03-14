module.exports = {
  proxy: {
    rules: { 
      "/gw/bind": { 
        "target": [{ 
          "url": "http://127.0.0.1:3533/etd/api/dev189", 
          "label": "test111" 
        }, 
        { 
          "url": "http://127.0.0.1:3533/etd/api/dev189_2", 
          "label": "test444" 
        }, 
        { 
          "url": "http://127.0.0.1:3533/etd/api/dev189_3", 
          "label": "test333", 
          "default": true 
        }], 
        // "trace": ["mongodb"], 
        // "quota": ["rule_test"] 
      }, 
      aa: "11111",
      // "/pool_gateway/api/mongo/document/list": {
      //   "target":"http://localhost:3331/oauth/api/mongo/document/list",
      //   "auth":["httpPortal"],
      //   "trace":["http","mongodb"]
      // },
      "/gw/rela/serviceRelation/AXN": {
        "target":"http://127.0.0.1:3533/etd/api/dev189",
        "auth":["httpYz"],
        "transformRequest":["binding","pa_hj","test"],
        "transformResponse":["test_ase","pa_hj"],
        "quota": ["rule_test","http_test","statistical_Day"],
        "trace":["mongodb","http"]
      }
    }
  },
  quota: {
    // enable: false
  },
  API: {
    // enable: false,
    controllers: {
      // enable: false,
    }
  },
  // trace: {
  //   mongodb: {
  //     onlyError: false
  //   }
  // }
}