/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/* Member model unit tests.                                                                       */
/*                                                                                                */
/* Note these tests do not mock out database components, but operate on the live db.              */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

import { expect } from 'chai';   // BDD/TDD assertion library
import dotenv     from 'dotenv'; // load environment variables from a .env file into process.env
dotenv.config();

import Member from '../../models/member.js';

import './before.js';


describe('Member model', function() {
    let memberId = null;

    const values = {
        Firstname: 'test',
        Lastname:  'user',
        Email:     'test@user.com',
        Active:    true,
    };

    it('creates member', async function() {
        memberId = await Member.insert(values);
        console.info('\tmember id', memberId);
    });

    it('fails to create duplicate member', async function() {
        try {
            await Member.insert(values);
            throw new Error('Member.insert should fail validation');
        } catch (e) {
            expect(e.message).to.equal("Duplicate entry 'test@user.com' for key 'Email'");
        }
    });

    it('gets member', async function() {
        const member = await Member.get(memberId);
        expect(member).to.be.an('object');
        expect(member.Firstname).to.equal('test');
    });

    it('gets member using string id', async function() {
        const member = await Member.get(memberId.toString());
        expect(member).to.be.an('object');
        expect(member.Firstname).to.equal('test');
    });

    it('gets member by value', async function() {
        const members = await Member.getBy('Firstname', 'test');
        expect(members).to.be.an('array');
        expect(members).to.have.lengthOf.at.least(1);
    });

    it('updates member', async function() {
        await Member.update(memberId, { Firstname: 'test2' });
        const member = await Member.get(memberId);
        expect(member).to.be.an('object');
        expect(member.Firstname).to.equal('test2');
        await Member.update(memberId, { Firstname: 'test' }); // set it back
    });

    it('fails to set no-such-field', async function() {
        const vals = { ...values, Firstname: 'validn-test', Email: 'validn@test', 'no-such-field': 'nothing here' };
        try {
            await Member.insert(vals);
            throw new Error('Member.insert should fail validation');
        } catch (e) {
            expect(e.message).to.equal("Unknown column 'no-such-field' in 'field list'");
        }
    });

    it('fails to create two members with same e-mail, different membername', async function() {
        const vals = { ...values, Firstname: 'test2' };
        try {
            await Member.insert(vals);
            throw new Error('Member.insert should fail validation');
        } catch (e) {
            expect(e.message).to.equal("Duplicate entry 'test@user.com' for key 'Email'");
        }
    });

    it('deletes member', async function() {
        const ok = await Member.delete(memberId);
        expect(ok).to.be.true;
    });

});
