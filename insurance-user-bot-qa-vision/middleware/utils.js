exports.cleanNumber = (str) => {
    while (str.indexOf('-') > -1)
    {
        let index = str.indexOf('-');
        str = str.substring(0, index) + str.substring(index + 1);
    }

    return str
}

exports.cityStateZip = (str) => {
    let address = {
        "city": "",
        "state": "",
        "zip": ""
    }

    let cityIndex = str.indexOf(',');
    address.city = str.substring(0, cityIndex);

    let stateIndex = str.indexOf(',', cityIndex + 1);
    address.state = str.substring(cityIndex + 2, stateIndex);

    address.zip = str.substring(stateIndex + 2);
    //console.log('Address Information: ', address);
    return address;
}