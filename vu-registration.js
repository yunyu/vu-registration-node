const fs = require('fs');
const querystring = require('querystring');
const cheerio = require('cheerio');
const FileCookieStore = require('tough-cookie-file-store');
const CookieJar = require('tough-cookie').CookieJar;
const jsonic = require('jsonic');
const sleep = require('sleep-promise');

const cookieJarPath = 'cookies.json';
const dataPath = 'data.json';

var rp = require('request-promise');

function printUsage() {
    console.log(
        'Usage:\n' +
        'node vu-registration.js savecookies\n' +
        'node vu-registration.js register 0420:true,0069:false\n\n' + 
        '* Username and password should be set via the VUNET_ID and VUNET_PW environment variables\n' +
        '  (they are only used for savecookies)\n' +
        '* The course ID is in the bottom left corner of the course description dialog\n' +
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
    var j = rp.jar(new FileCookieStore(cookieJarPath));
    rp = rp.defaults({
        jar: j,
        headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:52.0) Gecko/20100101 Firefox/52.0'}
    });
}

function saveCookie(username, password) {
    [cookieJarPath, dataPath].forEach(path => {
        if (fs.existsSync(path)) {
            fs.unlinkSync(path);
        }
    });
    initRequestPromise();
    var cheerioTransform = body => cheerio.load(body);
    var commodoreId;
    rp({
        uri: 'https://yes.vanderbilt.edu',
        transform: cheerioTransform
    })
    .then($ => Promise.resolve({
        action: $('form').attr('action'), 
        lt: $('[name="lt"]').attr('value'),
        _eventId: $('[name="_eventId"]').attr('value')
    }))
    .then(formData => rp.post({ 
            uri: 'https://login.mis.vanderbilt.edu' + formData.action,
            resolveWithFullResponse: true,
            followAllRedirects: true,
            form: {
                'username': username,
                'password': password,
                'lt': formData.lt,
                '_eventId': formData._eventId,
                'submit': 'LOGIN'
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
        var termCode = $('#selectedTerm').find('[selected="selected"]').attr('value');
        fs.writeFileSync(dataPath, JSON.stringify({'termCode': termCode, 'commodoreId': commodoreId}));
        console.log('Saved cookies for ID ' + commodoreId + ' with term code ' + termCode);
    });
}

function register(courseList) {
    initRequestPromise();
    var data = JSON.parse(fs.readFileSync(dataPath));
    var termCode = data['termCode'];
    var queueEnrollBase = 'https://webapp.mis.vanderbilt.edu/more/StudentClass!queueEnroll.action?selectedTermCode=' + termCode;
    var index = 0;
    for (let classNumber in courseList) {
        queueEnrollBase += '&enrollmentRequestItems%5B' + index + '%5D.classNumber=' + classNumber
            + '&enrollmentRequestItems%5B' + index + '%5D.waitList=' + courseList[classNumber].toString();
        index++;
    }
    rp(queueEnrollBase)
    .then(body => Promise.resolve(JSON.parse(body)['jobId']))
    .then(sleep(1750))
    .then(jobId => rp('https://webapp.mis.vanderbilt.edu/more/StudentClass!checkStatus.action?jobId=' + jobId))
    .then(body => console.log(body));
}