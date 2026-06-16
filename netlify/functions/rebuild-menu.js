exports.handler = async function () {
  const hookUrl = process.env.NETLIFY_MENU_REBUILD_HOOK_URL;

  if (!hookUrl) {
    return {
      statusCode: 500,
      body: 'Missing NETLIFY_MENU_REBUILD_HOOK_URL. Create a Netlify Build Hook and save it as this environment variable.'
    };
  }

  try {
    const response = await fetch(hookUrl, { method: 'POST' });

    if (!response.ok) {
      const text = await response.text();
      return {
        statusCode: 500,
        body: `Build hook failed: ${response.status} ${text}`
      };
    }

    return {
      statusCode: 200,
      body: 'Menu rebuild triggered.'
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: `Unable to trigger menu rebuild: ${error.message}`
    };
  }
};
