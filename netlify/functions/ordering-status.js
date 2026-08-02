const { getOrderingAvailability } = require('./ordering-availability');

exports.handler = async () => {
  try {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0'
      },
      body: JSON.stringify(getOrderingAvailability())
    };
  } catch (error) {
    console.error('Unable to determine ordering status', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0'
      },
      body: JSON.stringify({
        orderingAvailable: false,
        orderingSource: 'error',
        orderingMessage: 'Online ordering status is temporarily unavailable. Please call Victor’s for assistance.'
      })
    };
  }
};
