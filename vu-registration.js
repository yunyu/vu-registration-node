const fs = require('fs-extra');
const querystring = require('querystring');
const cheerio = require('cheerio');
const tough = require('tough-cookie');
const jsonic = require('jsonic');
const sleep = require('sleep-promise');

const cookieJarPath = 'cookies.json';
const dataPath = 'data.json';

let rp = require('request-promise-native');

function printUsage() {
    console.log(
        'Usage:\n' +
            'node vu-registration.js savecookies\n' +
            'node vu-registration.js register 0420:true,0069:false\n\n' +
            '* Username and password should be set via the VUNET_ID and VUNET_PW environment variables\n' +
            '  (use your VUnet ID, NOT your commodore ID)\n' +
            '* You can only register for courses that are already in your cart\n' +
            '* The course ID is in the top left corner of the course description dialog\n' +
            '* The boolean parameter in the course list is equivalent to "Waitlist If Full"',
    );
}

if (process.argv.length <= 2) {
    printUsage();
} else if (process.argv[2] === 'savecookies') {
    saveCookie(process.env.VUNET_ID, process.env.VUNET_PW)
        .then(res =>
            console.log(
                `Saved cookies for ID ${res.commodoreId} with term code ${
                    res.termCode
                }`,
            ),
        )
        .catch(e =>
            console.warn(
                'Failed to log in, are your credentials properly set?' + e,
            ),
        );
} else if (process.argv[2] === 'register' && process.argv.length === 4) {
    register(jsonic(process.argv[3]))
        .then(res =>
            res.enrollmentMessages
                .map(el => el.detailedMessage)
                .forEach(el => console.log(el)),
        )
        .catch(e =>
            console.warn('Failed to register, are the cookies saved?' + e),
        );
} else {
    printUsage();
}

const defaultJar = rp.jar();

function initRequestPromise() {
    if (fs.existsSync(cookieJarPath)) {
        const fileJar = rp.jar();
        fileJar._jar = tough.CookieJar.deserializeSync(
            JSON.parse(fs.readFileSync(cookieJarPath)),
        );
        fileJar.setCookie = function(cookieOrStr, uri, options) {
            return fileJar._jar.setCookieSync(cookieOrStr, uri, options || {});
        };
        fileJar.getCookieString = function(uri) {
            return fileJar._jar.getCookieStringSync(uri);
        };
        fileJar.getCookies = function(uri) {
            return fileJar._jar.getCookiesSync(uri);
        };
        rp = rp.defaults({
            jar: fileJar,
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:52.0) Gecko/20100101 Firefox/52.0',
            },
        });
    } else {
        rp = rp.defaults({
            jar: defaultJar,
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:52.0) Gecko/20100101 Firefox/52.0',
            },
        });
    }
}

async function saveCookie(username, password) {
    for (let path of [cookieJarPath, dataPath]) {
        if (await fs.exists(path)) {
            await fs.unlink(path);
        }
    }
    initRequestPromise();
    const transform = body => cheerio.load(body);
    let $ = await rp({
        uri: 'https://acad.app.vanderbilt.edu/student-search/Entry.action',
        transform,
    });
    const formData = { action: $('form').attr('action') };

    const loginRes = await rp.post({
        uri: `https://sso.vanderbilt.edu${formData.action}`,
        resolveWithFullResponse: true,
        followAllRedirects: true,
        form: {
            'pf.username': username,
            'pf.pass': password,
            'pf.ok': 'clicked',
            'pf.cancel': '',
        },
    });

    const commodoreId = querystring.parse(loginRes.request.uri.query)
        .commodoreId;
    $ = await rp({
        uri: `https://acad.app.vanderbilt.edu/more/SearchClasses!input.action?commodoreIdToLoad=${commodoreId}`,
        transform,
    });
    const termCode = "0955";

    if (!termCode || !commodoreId) {
        throw new Error("Update the term code (or commodoreId)!" + termCode + ' ' + commodoreId);
    }

    const result = { termCode, commodoreId };
    await fs.writeFile(dataPath, JSON.stringify(result));
    await fs.writeFile(
        cookieJarPath,
        JSON.stringify(defaultJar._jar.serializeSync()),
    );
    return result;
}

async function register(courseList) {
    initRequestPromise();
    const data = JSON.parse(await fs.readFile(dataPath));
    let queueEnrollBase = `https://acad.app.vanderbilt.edu/more/StudentClass!queueEnroll.action?selectedTermCode=${
        data.termCode
    }`;
    let index = 0;
    for (const classNumber in courseList) {
        queueEnrollBase +=
            '&enrollmentRequestItems%5B' +
            index +
            '%5D.classNumber=' +
            classNumber +
            '&enrollmentRequestItems%5B' +
            index +
            '%5D.waitList=' +
            courseList[classNumber].toString();
        ++index;
    }

    const transform = body => JSON.parse(body);
    const queueResult = await rp({ uri: queueEnrollBase, transform });
    console.log(`Queued with job ID ${queueResult.jobId}`);

    let status = null;
    await sleep(1000);
    while (!status || !status.enrollmentMessages) {
        await sleep(750);
        status = await rp({
            uri: `https://acad.app.vanderbilt.edu/more/StudentClass!checkStatus.action?jobId=${
                queueResult.jobId
            }`,
            transform,
        });
    }
    return status;
}
