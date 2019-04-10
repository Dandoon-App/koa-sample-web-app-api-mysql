/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/* Send out e-mail.                                                                               */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

import nodemailer from 'nodemailer';   // sends e-mails from Node.js
import handlebars from 'handlebars';   // logicless templating language
import { JSDOM }  from 'jsdom';        // DOM Document interface in Node!
import htmlToText from 'html-to-text'; // converts html to beautiful text
import fs         from 'fs-extra';     // fs with extra functions & promise interface
import dotenv     from 'dotenv';       // load environment variables from a .env file into process.env

dotenv.config();

import User from '../models/user.js';

let transport = null; // NodeMailer transport - created on first usage


class Mail {

    /**
     * Private getter to return SMTP transporter.
     *
     *  SMTP connection details are obtained from SMTP_CONNECTION environment variable - either as eg
     *    service=gmail; auth.user=me@gmail.com; auth.pass=mypw
     *  or
     *    host=smtp.mailhost.com; port=587; auth.user=myusername; auth.pass=mypassword
     *
     * For gmail, the service=gmail method will require 'less secure apps' to be enabled, or Oauth2
     * can be used.
     *
     * See nodemailer.com/smtp, nodemailer.com/usage/using-gmail, nodemailer.com/smtp/oauth2.
     */
    static get transporter() {
        if (transport != null) return transport;

        // transform SMTP_CONNECTION to e.g. [ [ 'service', 'gmail' ], [ 'auth.user', 'me@gmail.com' ], [ 'auth.pass', 'mypw' ] ]
        const smtpKeyVal = process.env.SMTP_CONNECTION.split(';').map(v => v.trim().split('='));
        // transform smtpKeyVal to e.g. { service: 'gmail', auth: { user: 'me@gmail.com', pass: 'mypw' } }
        const smtpConfig = smtpKeyVal.reduce((config, keyVal) => {
            const [ key, val ] = keyVal;
            const keyParts = key.split('.');
            if (keyParts.length > 1) config[keyParts[0]] = config[keyParts[0]] || {}; // create { auth: {} } if necessary
            keyParts.length==1
                ? config[keyParts[0]] = val               // e.g. { service: 'gmail' }
                : config[keyParts[0]][keyParts[1]] = val; // e.g. { auth: { user: 'me@gmail.com' } }
            return config;
        }, {});
        if (smtpConfig.port) smtpConfig.secure = smtpConfig.port == 465;

        transport = nodemailer.createTransport(smtpConfig);

        return transport;
    }


    /**
     * Private getter for 'from' reply-to address.
     */
    static get from() {
        return 'noreply@movable-type.co.uk'; // this could be obtained from environment variable
    }


    /**
     * Send e-mail using template.
     *
     * @param   {string} to - E-mail recipient(s).
     * @param   {string} template - Handlebars template for e-mail body.
     * @param   {string} context - Context for mail-merge into template.
     * @param   {Object} ctx - Koa ctx object.
     */
    static async send(to, template, context, ctx) {
        if (global.it) return; // don't send e-mails within mocha tests

        // get password reset template, completed with generated token
        const templateHtml = await fs.readFile(`app-admin/templates/${template}.html`, 'utf8');
        const templateHbs = handlebars.compile(templateHtml);
        const html = templateHbs(context);

        // get e-mail subject from <title> element
        const document = new JSDOM(html).window.document;
        const subject = document.querySelector('title').textContent;

        // prepare e-mail message
        const message = {
            to:      to,
            from:    Mail.from,
            subject: subject,
            html:    html,
            text:    htmlToText.fromString(html),
        };

        // don't send e-mail to live indicated recipient in dev/staging
        if (ctx.app.env != 'production' && !ctx.state.user) {
            // dev/staging but no logged in user: log to console & bail out
            console.info(`Mail.send info: ‘${subject}’ (${template}) not sent to ${to} from dev env`);
            return;
        }
        if (ctx.app.env != 'production') {
            // dev/staging: replace recipient with logged in user (i.e. the developer), with hdr showing orig recipient
            const currentUser = await User.get(ctx.state.user.id);
            Object.assign(message, { to: currentUser.Email, headers: { 'X-Orig-To': to } });
        }

        // send out e-mail
        //const info = await transporter.verify(); TODO: ??
        const info = await Mail.transporter.sendMail(message);
        console.info('Mail.send info', 'accepted:', info.accepted, 'response:', info.response);
    }


    /**
     * Send e-mail with supplied html.
     *
     * @param {string} to - E-mail recipient(s).
     * @param {string} subject - E-mail subject line.
     * @param {string} html - HTML content for e-mail body.
     */
    static async sendHtml(to, subject, html, ctx) {
        if (global.it) return; // don't send e-mails within mocha tests

        const message = {
            to:      to,
            from:    Mail.from,
            subject: subject,
            html:    html,
            text:    htmlToText.fromString(html),
        };

        // don't send e-mail to live indicated recipient in dev/staging
        if (ctx.app.env != 'production' && !ctx.state.user) {
            // dev/staging but no logged in user: log to console & bail out
            console.info(`Mail.send info: ‘${subject}’ not sent to ${to} from dev env`);
            return null;
        }
        if (ctx.app.env != 'production') {
            // dev/staging: replace recipient with logged in user (i.e. the developer), with hdr showing orig recipient
            const currentUser = await User.get(ctx.state.user.id);
            Object.assign(message, { to: currentUser.Email, headers: { 'X-Orig-To': to } });
        }

        // send out e-mail
        const info = await Mail.transporter.sendMail(message);
        console.info('Mail.sendHtml info', info);
    }


    /**
     * Send e-mail with supplied (plain-) text.
     *
     * @param {string} to - E-mail recipient(s).
     * @param {string} subject - E-mail subject line.
     * @param {string} text - Text content for plain-text e-mail body.
     */
    static async sendText(to, subject, text, ctx) {
        if (global.it) return null; // don't send e-mails within mocha tests

        const message = {
            to:      to,
            from:    Mail.from,
            subject: subject,
            text:    text,
        };

        // don't send e-mail to live indicated recipient in dev/staging
        if (ctx.app.env != 'production' && !ctx.state.user) {
            // dev/staging but no logged in user: log to console & bail out
            console.info(`Mail.send info: ‘${subject}’ not sent to ${to} from dev env`);
            return null;
        }
        if (ctx.app.env != 'production') {
            // dev/staging: replace recipient with logged in user (i.e. the developer), with hdr showing orig recipient
            const currentUser = await User.get(ctx.state.user.id);
            Object.assign(message, { to: currentUser.Email, headers: { 'X-Orig-To': to } });
        }

        // send out e-mail
        const info = await Mail.transporter.sendMail(message);
        console.info('Mail.sendText info', info);
    }
}

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

export default Mail;
