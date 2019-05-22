// Load the env file to get access to the GCC REST API URL
const path = require('path');
const envRelativeDir = path.normalize(__dirname + '/..')
const ENV_FILE = path.join(envRelativeDir, '.env');
const env = require('dotenv').config({ path: ENV_FILE });
// Keep in mind, this is only being used for development purposes. In a production use case,
// these values would be loaded through environment variables created the Azure Application Settings

const axios = require('axios');
axios.defaults.baseURL = process.env.gccRESTAPI;
axios.defaults.headers.post['Content-Type'] = 'application/json';

exports.getClaimStatus = async userID => {
    const url = '/claim/' + userID;
    try {
        const response = await axios.get(url);
        const data = response.data;
        return data;
        //console.log(data);
    } catch (error) {
        console.log(error);
    }
}

exports.postClaimUpdate = async update => {
    const url = '/claim/ClaimStatusUpdate';
    try {
        const response = await axios.post(url, update);
        const data = response.data;
        return data;
        //console.log(data);
    } catch (error) {
        console.log(error);
    }
}

exports.postPhoneProfile = async phone => {
    const url = '/userprofile/Phone'
    try {
        const response = await axios.post(url, phone);
        const data = response.data;
        return data;
        //console.log(data);
    } catch (error) {
        console.log(error);
    }
}

exports.postEmailProfile = async email => {
    const url = '/userprofile/Email'
    try {
        const response = await axios.post(url, email);
        const data = response.data;
        return data;
        //console.log(data);
    } catch (error) {
        console.log(error);
    }
}

exports.postAddressProfile = async address => {
    const url = '/userprofile/Address'
    try {
        const response = await axios.post(url, address);
        const data = response.data;
        return data;
        //console.log(data);
    } catch (error) {
        console.log(error);
    }
}