/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/* Api integration/acceptance tests (just a few sample tests, not full coverage)                  */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

'use strict';
/* eslint no-console:off */
/* eslint no-unused-expressions:off */ /* (for expect().to.be.empty ) */

const supertest = require('supertest-as-promised'); // supertest with a promise interface
const expect    = require('chai').expect;           // BDD/TDD assertion library
require('mocha');                                   // simple, flexible, fun test framework

const app = require('../app.js');


const request = supertest.agent(app.listen());

const headers = { Host: 'api.localhost' }; // set host header (note Accept is defaulted to application/json)


describe('API'+' ('+app.env+'/'+process.env.DB_DATABASE+')', function() {
    let userId = null, userPw = null;

    describe('/auth', function() {
        it('returns 401 on missing auth header', async function() {
            const response = await request.get('/auth').set(headers);
            expect(response.status).to.equal(401, response.text);
            expect(response.body).to.be.an('object');
        });

        it('returns 401 on unrecognised email', async function() {
            const response = await request.get('/auth').set(headers).auth('xxx@user.com', 'admin');
            expect(response.status).to.equal(401, response.text);
            expect(response.body).to.be.an('object');
        });

        it('returns 401 on bad password', async function() {
            const response = await request.get('/auth').set(headers).auth('admin@user.com', 'bad-password');
            expect(response.status).to.equal(401, response.text);
            expect(response.body).to.be.an('object');
        });

        it('returns auth details', async function() {
            const response = await request.get('/auth').set(headers).auth('admin@user.com', 'admin');
            expect(response.status).to.equal(200, response.text);
            expect(response.body).to.be.an('object');
            expect(response.body).to.contain.keys('id', 'token');
            userId = response.body.id.toString();
            userPw = response.body.token;
            // console.log(userId, userPw);
        });
    });

    describe('/members', function() {
        describe('auth checks', function() {
            it('returns 401 on unrecognised auth id', async function() {
                const response = await request.get('/members').set(headers).auth('999999', 'x');
                expect(response.status).to.equal(401, response.text);
            });

            it('returns 401 on bad auth password', async function() {
                const response = await request.get('/members').set(headers).auth(userId, 'bad-password');
                expect(response.status).to.equal(401, response.text);
                expect(response.body).to.be.an('object');
            });

            it('returns members list', async function() {
                const response = await request.get('/members').set(headers).auth(userId, userPw);
                expect(response.status).to.equal(200, response.text);
                expect(response.body).to.be.an('array');
                expect(response.body).to.have.length.above(1);
            });
        });
        describe('CRUD', function() {
            let id = null;
            it('adds a member', async function() {
                const values = { Firstname: 'Test', Lastname: 'User', Email: 'test@user.com', Active: 'true' };
                const response = await request.post('/members').set(headers).auth(userId, userPw).send(values);
                expect(response.status).to.equal(201, response.text);
                expect(response.body).to.be.an('object');
                expect(response.body).to.contain.keys('MemberId', 'Firstname', 'Lastname', 'Email');
                expect(response.body.Email).to.equal('test@user.com');
                expect(response.headers.location).to.equal('/members/'+response.body.MemberId);
                id = response.body.MemberId;
            });

            it('gets a member (json)', async function() {
                const response = await request.get('/members/'+id).set(headers).auth(userId, userPw);
                expect(response.status).to.equal(200, response.text);
                expect(response.body).to.be.an('object');
                expect(response.body).to.contain.keys('MemberId', 'Firstname', 'Lastname', 'Email');
                expect(response.body.Email).to.equal('test@user.com');
                expect(response.body.Firstname).to.equal('Test');
                expect(response.body.Active).to.be.true;
            });

            it('gets a member (xml)', async function() {
                const hdrs = { Host: 'api.localhost', Accept: 'application/xml' }; // set host & accepts headers
                const response = await request.get('/members/'+id).set(hdrs).auth(userId, userPw);
                expect(response.status).to.equal(200, response.text);
                expect(response.text.slice(0, 38)).to.equal('<?xml version="1.0" encoding="UTF-8"?>');
                expect(response.text.match(/<Email>(.*)<\/Email>/)[1]).to.equal('test@user.com');
                expect(response.text.match(/<Firstname>(.*)<\/Firstname>/)[1]).to.equal('Test');
                expect(response.text.match(/<Active>(.*)<\/Active>/)[1]).to.equal('true');
            });

            it('gets a member (filtered)', async function() {
                const response = await request.get('/members?firstname=lewis').set(headers).auth(userId, userPw);
                expect(response.status).to.equal(200, response.text);
                expect(response.body).to.be.an('array');
                expect(response.body).to.have.length(1);
            });

            it('handles empty members list', async function() {
                const response = await request.get('/members?firstname=nomatch').set(headers).auth(userId, userPw);
                expect(response.status).to.equal(204, response.text);
                expect(response.body).to.be.empty;
            });

            it('updates a member', async function() {
                const values = { Firstname: 'Updated', Lastname: 'User', Email: 'test@user.com' };
                const response = await request.patch('/members/'+id).set(headers).auth(userId, userPw).send(values);
                expect(response.status).to.equal(200, response.text);
                expect(response.body).to.be.an('object');
                expect(response.body).to.contain.keys('MemberId', 'Firstname', 'Lastname', 'Email');
                expect(response.body.Firstname).to.equal('Updated');
            });

            it('fails to add member with duplicate e-mail', async function() {
                const values = { Firstname: 'Test', Lastname: 'User', Email: 'test@user.com' };
                const response = await request.post('/members').set(headers).auth(userId, userPw).send(values);
                expect(response.status).to.equal(409, response.text);
                expect(response.text).to.equal("Duplicate entry 'test@user.com' for key 'Email'");
            });

            it('deletes a member', async function() {
                const response = await request.delete('/members/'+id).set(headers).auth(userId, userPw);
                expect(response.status).to.equal(200, response.text);
                expect(response.body).to.be.an('object');
                expect(response.body).to.contain.keys('MemberId', 'Firstname', 'Lastname', 'Email');
                expect(response.body.Email).to.equal('test@user.com');
                expect(response.body.Firstname).to.equal('Updated');
            });

            it('fails to get deleted member', async function() {
                const response = await request.get('/members/'+id).set(headers).auth(userId, userPw);
                expect(response.status).to.equal(404, response.text);
                expect(response.body).to.be.an('object');
            });

            it('fails to update deleted member', async function() {
                const values = { Firstname: 'Updated', Lastname: 'User', Email: 'test@user.com' };
                const response = await request.patch('/members/'+id).set(headers).auth(userId, userPw).send(values);
                expect(response.status).to.equal(404, response.text);
            });
        });
    });

    describe('misc', function() {
        it('returns 401 for non-existent resource without auth', async function() {
            const response = await request.get('/zzzzzz').set(headers);
            expect(response.status).to.equal(401, response.text);
        });

        it('returns 404 for non-existent resource with auth', async function() {
            const response = await request.get('/zzzzzz').set(headers).auth(userId, userPw);
            expect(response.status).to.equal(404, response.text);
        });
    });
});
