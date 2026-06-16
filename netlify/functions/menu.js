const { getCloverMenu } = require('./menu-data');

exports.handler = async function () {
  try {
    const menu = await getCloverMenu();

    return json(200, menu);
  } catch (error) {
    return json(500, {
      error: 'Unable to load Clover menu',
      message: error.message
    });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}
