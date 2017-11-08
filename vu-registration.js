const fs = require('fs');
const querystring = require('querystring');
const cheerio = require('cheerio');
const FileCookieStore = require('tough-cookie-file-store');
const CookieJar = require('tough-cookie').CookieJar;
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
        '* The boolean parameter in the course list is equivalent to "Waitlist If Full"'
    );
}

if (process.argv.length <= 2) {
    printUsage();
} else if (process.argv[2] === 'savecookies') {
    saveCookie(process.env.VUNET_ID, process.env.VUNET_PW)
        .then(res => {
            console.log(`Saved cookies for ID ${res.commodoreId} with term code ${res.termCode}`);
        });
} else if (process.argv[2] === 'register' && process.argv.length === 4) {
    register(jsonic(process.argv[3]))
        .then(res => res.enrollmentMessages.map(el => el.detailedMessage).forEach(el => console.log(el)));
} else {
    printUsage();
}

function initRequestPromise() {
    const j = rp.jar(new FileCookieStore(cookieJarPath));
    rp = rp.defaults({
        jar: j,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:52.0) Gecko/20100101 Firefox/52.0' }
    });
}

async function saveCookie(username, password) {
    [cookieJarPath, dataPath].forEach(path => {
        if (fs.existsSync(path)) {
            fs.unlinkSync(path);
        }
    });
    initRequestPromise();

    const transform = body => cheerio.load(body);
    let $ = await rp({ uri: 'https://yes.vanderbilt.edu', transform });
    const formData = { action: $('form').attr('action') };
    const res = await rp.post({
        uri: `https://sso.vanderbilt.edu${formData.action}`,
        resolveWithFullResponse: true,
        followAllRedirects: true,
        form: {
            'pf.username': username,
            'pf.pass': password,
            'pf.ok': 'clicked'
        }
    });

    const commodoreId = querystring.parse(res.request.uri.query)['commodoreId'];
    $ = await rp({ uri: `https://webapp.mis.vanderbilt.edu/more/SearchClasses!input.action?commodoreIdToLoad=${commodoreId}`, transform });
    const termCode = $('#selectedTerm').find('[selected="selected"]').attr('value');

    const result = { termCode, commodoreId };
    fs.writeFileSync(dataPath, JSON.stringify(result));
    return result;
}

async function register(courseList) {
    initRequestPromise();
    const data = JSON.parse(fs.readFileSync(dataPath));
    let queueEnrollBase = `https://webapp.mis.vanderbilt.edu/more/StudentClass!queueEnroll.action?selectedTermCode=${data.termCode}`;
    let index = 0;
    for (const classNumber in courseList) {
        queueEnrollBase += '&enrollmentRequestItems%5B' + index + '%5D.classNumber=' + classNumber
            + '&enrollmentRequestItems%5B' + index + '%5D.waitList=' + courseList[classNumber].toString();
        ++index;
    }

    const transform = body => JSON.parse(body);
    const body = await rp({ uri: queueEnrollBase, transform });
    console.log(`Queued with job ID ${body.jobId}`);

    let status = null;
    await sleep(1000);
    while (!status || status.jobStatus.status !== 'C') {
        await sleep(750);
        status = await rp({ uri: `https://webapp.mis.vanderbilt.edu/more/StudentClass!checkStatus.action?jobId=${body.jobId}`, transform });
    }
    return status;
}
