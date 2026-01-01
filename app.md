#Enphase Data Capture

I need to implement application that will pull data about solar panel production from enphase devices that are on my local network and push it to influxdb.
The end goal is to have all data in influxdb that then will be visualized with grafana. This specific app will only take care of pulling the data on predefined intervals and storing them in influxdb.

##Key requirements
- Application should be be done in similar fashion like this repo (https://github.com/ejci/homewizzard-data-capture)
- Application has a detailed configuration and all configuration should be exposed to environment variables
- Application will pull data from the enphase gateways based on ip or mdns name
- All data will be pushed to influx db and configuration will be exposed to environment variables
- Application schould be able to run in background with nodejs
- The whole application should be containerized with docker
- Application should be able to run on any platform that supports nodejs and docker and able to recover from a network connection issues and continue to run
- Application should utilize the Enphase local envoy API to pull data (see bellow)
- If influxdb is not available at start or any of the env variables is not set, application should exit with error

##Logging locally and gathering data from Enphase envoy
1. Get serial number from https://IP_ADDRESS/info. It produces XML and the serial number is under  envoy_info.device.sn
2. Pull the token based on the serial number and username and password. User name and password will be stored in environment variables
```python
    import json
    import requests

    # REPLACE ITEMS BELOW 
    user='email@example.com'
    password='password'
    envoy_serial='your_envoy_serial_number'
    # DO NOT CHANGE ANYTHING BELOW

    data = {'user[email]': user, 'user[password]': password}
    response = requests.post('https://enlighten.enphaseenergy.com/login/login.json?',data=data)
    response_data = json.loads(response.text)
    data = {'session_id': response_data['session_id'], 'serial_num': envoy_serial, 'username':user}
    response = requests.post('https://entrez.enphaseenergy.com/tokens', json=data)
    token_raw = response.text
    print(token_raw)
```
3. Store the token in enphase_token.json file
4. Chek the https://IP_ADDRESS/auth/check_jwt with the Bearer token from the enphase_token.json file
5. If the token is valid, continue to the next step
6. If the token is not valid, get a new token and store it in enphase_token.json file   
7. Use the token to pull data from the https://IP_ADDRESS/home.json
8. Get data from https://IP_ADDRESS/api/v1/production/inverters with the Bearer token from the enphase_token.json file and store lastReportWatts and maxReportWatts in influxdb based on the serial number of the inverter

##Please consider
- Error handling
- Errors of the application should be also pushed to influxdb
- Edge cases
- Performance optimization
- Best practices for nodejs

##Deliverables
- Dockerfile
- .env.example
- app.js
- package.json
- README.md
- .gitignore

##Other
Please do not unnecessarily remove any comments or code.
Generate the code with clear comments explaining the logic.
