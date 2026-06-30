const axios = require('axios');
const sifaloConfig = require('../config/sifalo.config');

const initiatePayment = async (paymentData) => {
    try {
        // Create Basic Auth header with username and password
        const auth = Buffer.from(`${sifaloConfig.username}:${sifaloConfig.password}`).toString('base64');

        console.log('Initiating Sifalo payment...');
        console.log('API URL:', sifaloConfig.apiUrl);
        console.log('Username:', sifaloConfig.username);
        console.log('Payment Data:', JSON.stringify(paymentData, null, 2));

        // Build payload according to Sifalo gateway API (use fields provided by controller)
        const account = paymentData.account;
        const gateway = sifaloConfig.gateway || paymentData.gateway || 'waafi';
        const orderId = paymentData.order_id || paymentData.metadata?.billId || `ORDER_${Date.now()}`;
        const payload = {
            account: account,
            gateway: gateway,
            amount: paymentData.amount?.toString() || String(paymentData.amount || ''),
            currency: paymentData.currency || 'USD',
            order_id: orderId,
        };

        console.log("payload" , payload)

        // const payload = {
        //     account: "654271170",
        //     gateway: "edahab",
        //     amount: "100",
        //     currency: 'USD',
        //     order_id: "ABC123",
        // };

        // Ensure we don't accidentally keep a version segment like `/v1` in the base URL
        const rawApiUrl = sifaloConfig.apiUrl || 'https://api.sifalopay.com';
        const baseUrl = rawApiUrl.replace(/\/v\d+(?:\/)?$/i, '').replace(/\/$/, '');
        const endpoint = baseUrl + '/gateway/';

        // attempt request with a longer timeout and one retry on timeout
        const options = {
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            timeout: 60000
        };

        let response;
        try {
            response = await axios.post(endpoint, payload, options);
        } catch (err) {
            // retry once on timeout or transient network errors
            const isTimeout = err.code === 'ECONNABORTED' || /timeout of/.test(err.message);
            if (isTimeout) {
                console.warn('Sifalo request timed out; retrying once...');
                response = await axios.post(endpoint, payload, options);
            } else {
                throw err;
            }
        }

        console.log('Sifalo Response:', response.data);

        // Provider returns { code, sid, response }
        const resp = response.data || {};
        const code = String(resp.code || '');
        const sid = resp.sid || resp.SID || resp.sid?.toString();
        const message = resp.response || resp.message || '';

        // Map provider code to a status
        let mappedStatus = 'PENDING';
        if (code === '601') mappedStatus = 'SUCCESS';
        else if (code === '603') mappedStatus = 'PENDING';
        else mappedStatus = 'FAILED';

        return {
            code,
            sid,
            message,
            status: mappedStatus,
            raw: resp,
        };
    } catch (error) {
        console.error('SifaloPay Error Details:');
        console.error('Status:', error.response?.status);
        console.error('Status Text:', error.response?.statusText);
        console.error('Response Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Error Message:', error.message);
        console.error('Request URL:', error.config?.url);

        // Build a clearer error for consumers
        const status = error.response?.status;
        const respData = error.response?.data;
        const providerMessage = respData?.message || respData?.response || respData || error.message;

        const err = new Error(`SifaloPay error${status ? ` (status ${status})` : ''}: ${typeof providerMessage === 'string' ? providerMessage : JSON.stringify(providerMessage)}`);
        err.status = status || 500;
        throw err;
    }
};

const verifyPayment = async (transactionId) => {
    try {
        const auth = Buffer.from(`${sifaloConfig.username}:${sifaloConfig.password}`).toString('base64');

        const response = await axios.get(
            `${sifaloConfig.apiUrl}/payment/${transactionId}`,
            {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error('Payment verification error:', error.response?.data || error.message);
        return null;
    }
};

module.exports = {
    initiatePayment,
    verifyPayment
};
