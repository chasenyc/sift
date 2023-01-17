// Segment & Sift
const siftEndpoint = 'https://api.sift.com/v205/events';

function convertEvent(event) {
    let fields = false;
    switch (event.event) {
        case 'Product Added':
            fields = parseProductAdded(event);
            break;
        case 'Voucher Applied':
            fields = parseVoucherApplied(event);
            break;
        case 'Signed Up':
            fields = parseSignedUp(event);
            break;
        case 'Product Removed':
            fields = parseProductRemoved(event);
            break;
        default:
            console.log('Not an expected event');
            break;
    }

    return fields;
}


function parseProductAdded(event) {
    return Object.assign({},
        buildUserProperties(event),
        buildBrowserData(event),
        {
            $type: '$add_item_to_cart',
            $item: buildProductItemFromEvent(event),
        }
    );
}

function parseVoucherApplied(event) {
    if (!doesUserIdExist(event)) {
        return false;
    }

    return Object.assign({},
        buildUserProperties(event),
        buildBrowserData(event),
        {
            $type: '$add_promotion',
            $promotions: [
                {
                    $promotion_id: event.properties.voucher_id.toString(),
                    $status: '$success',
                }
            ]
        }
    );
}

function parseSignedUp(event) {
    return Object.assign({},
        buildUserProperties(event),
        buildBrowserData(event),
        {
            $type: '$create_account',
        }
    )
}

function parseProductRemoved(event) {
    return Object.assign({},
        buildUserProperties(event),
        buildBrowserData(event),
        {
            $type: '$remove_item_from_cart',
            $item: buildProductItemFromEvent(event),
        }
    )
}

function parseProfileUpdated(event) {
    if (event.properties &&
        event.properties.changes &&
        event.properties.changes.includes('password')) {
        return parsePasswordUpdated(event);
    }

    return Object.assign({},
        buildUserProperties(event),
        buildBrowserData(event),
        {
            $type: '$update_account',
        }
        // TODO: no phone number or email available
    );
}

function parsePasswordUpdated(event) {
    return Object.assign({},
        buildUserProperties(event),
        buildBrowserData(event),
        {
            $type: '$update_account',
            $reason: '$user_update',
        }
        // TODO: no phone number or email available
    );
}

function parseIdentified(event) {
    return Object.assign({},
        buildUserProperties(event),
        buildBrowserData(event),
        {
            $type: '$link_session_to_user',
        }
    )
}

function buildProductItemFromEvent(event) {
    let properties = event.properties;
    if (!properties) {
        return null;
    }

    return {
        $item_id: properties.product_id.toString(),
        $product_title: properties.product_name,
        $price: properties.display_price * 1000000,
        $currency_code: properties.currency,
        $quantity: properties.num_tickets,
    };
}

function doesUserIdExist(event) {
    return event.properties && event.properties.pub_id
}

function buildUserProperties(event) {
    let fields = {
        $session_id: event.anonymousId,
    }

    if (doesUserIdExist(event)) {
        fields.$user_id = event.properties.pub_id;
    }

    return fields;
}



function buildBrowserData(event) {
    let browser = (event.context && event.context.userAgent) ? 
    {
        $browser: {
            $user_agent: event.context.userAgent,
        },
    } : {}

    let country = (event.property && event.property.country) ? {
        $site_country: event.property.country,
    } : {}

    return Object.assign({},
        browser,
        country,
    );
}

async function siftEventCall(fields) {
	const res = await fetch(siftEndpoint, {
		body: JSON.stringify(fields),
		headers: { 'Content-Type': 'application/json' },
		method: 'post'
	});

	const siftResponse = await res.json();

	if (siftResponse.status <= 0) {
		// Please implement conditions for retries.
	} else if (siftResponse.status >= 0) {
		throw new InvalidEventPayload(siftResponse.error_message);
	}
}

async function onTrack(event) {
    let fields = convertEvent(event);
    
    if (!fields) {
        return;
    }

    fields = Object.assign(fields, {
        $api_key: 'e67587f1ba8d0b9a' //TODO: API KEY
    });

    return siftEventCall(fields);
}

async function onIdentify(event) {
	if (!event.properties ||
        !event.properties.pub_id) return;

    let fields = parseIdentified(event);

	return siftEventCall(fields);
}