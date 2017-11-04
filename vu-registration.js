const fs = require('fs');
const querystring = require('querystring');
const cheerio = require('cheerio');
const FileCookieStore = require('tough-cookie-file-store');
const CookieJar = require('tough-cookie').CookieJar;
const jsonic = require('jsonic');
const sleep = require('sleep-promise');

const cookieJarPath = 'cookies.json';
const dataPath = 'data.json';

let rp = require('request-promise');

function printUsage() {
    console.log(
        'Usage:\n' +
        'node vu-registration.js savecookies\n' +
        'node vu-registration.js register 0420:true,0069:false\n\n' +
        '* Username and password should be set via the VUNET_ID and VUNET_PW environment variables\n' +
        '  (they are only used for savecookies)\n' +
        '* You can only register for courses that are already in your cart\n' +
        '* The course ID is in the top left corner of the course description dialog\n' +
        '* The boolean parameter in the course list is equivalent to "Waitlist If Full"'
    );
}

if (process.argv.length <= 2) {
    printUsage();
} else if (process.argv[2] == 'savecookies') {
    saveCookie(process.env.VUNET_ID, process.env.VUNET_PW);
} else if (process.argv[2] == 'register' && process.argv.length == 4) {
    register(jsonic(process.argv[3]));
} else {
    printUsage();
}

function initRequestPromise() {
    let j = rp.jar(new FileCookieStore(cookieJarPath));
    rp = rp.defaults({
        jar: j,
        headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:52.0) Gecko/20100101 Firefox/52.0'}
    });
}

function saveCookie(username, password) {
    [cookieJarPath, dataPath].forEach(path => {
        if (fs.existsSync(path)) {
            fs.unlinkSync(path);
        }
    });
    initRequestPromise();
    let cheerioTransform = body => cheerio.load(body);
    let commodoreId;
    rp({
        uri: 'https://yes.vanderbilt.edu',
        transform: cheerioTransform
    })
    .then($ => Promise.resolve({
        action: $('form').attr('action')
    }))
    .then(formData => rp.post({
            uri: 'https://sso.vanderbilt.edu' + formData.action,
            resolveWithFullResponse: true,
            followAllRedirects: true,
            form: {
                'pf.username': username,
                'pf.pass': password,
                'pf.ok': 'clicked'
            }
        })
    )
    .then(res => {
        commodoreId = querystring.parse(res.request.uri.query)['commodoreId'];
        return rp({
            uri: 'https://webapp.mis.vanderbilt.edu/more/SearchClasses!input.action?commodoreIdToLoad=' + commodoreId,
            transform: cheerioTransform
        })
    })
    .then($ => {
        let termCode = $('#selectedTerm').find('[selected="selected"]').attr('value');
        fs.writeFileSync(dataPath, JSON.stringify({'termCode': termCode, 'commodoreId': commodoreId}));
        console.log('Saved cookies for ID ' + commodoreId + ' with term code ' + termCode);
    });
}

function register(courseList) {
    initRequestPromise();
    let data = JSON.parse(fs.readFileSync(dataPath));
    let termCode = data['termCode'];
    let queueEnrollBase = 'https://webapp.mis.vanderbilt.edu/more/StudentClass!queueEnroll.action?selectedTermCode=' + termCode;
    let index = 0;
    for (let classNumber in courseList) {
        queueEnrollBase += '&enrollmentRequestItems%5B' + index + '%5D.classNumber=' + classNumber
            + '&enrollmentRequestItems%5B' + index + '%5D.waitList=' + courseList[classNumber].toString();
        index++;
    }
    rp(queueEnrollBase)
    .then(body => Promise.resolve(JSON.parse(body)['jobId']))
    .then(sleep(2000))
    .then(jobId => rp('https://webapp.mis.vanderbilt.edu/more/StudentClass!checkStatus.action?jobId=' + jobId))
    .then(body => {
        status = JSON.parse(body);
        for (let index in status.enrollmentMessages) {
           console.log(status.enrollmentMessages[index].detailedMessage);
        }
    })
}
