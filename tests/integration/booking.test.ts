import faker from '@faker-js/faker';
import { TicketStatus } from '@prisma/client';
import httpStatus from 'http-status';
import * as jwt from 'jsonwebtoken';
import supertest from 'supertest';
import {
  createEnrollmentWithAddress,
  createUser,
  createTicketType,
  createTicket,
  createTicketTypeWithHotelIncluded,
  createPayment,
  createBooking,
} from '../factories';
import { cleanDb, generateValidToken } from '../helpers';
import { createFullRoom, createHotel, createHotelRoom } from '../factories/hotels-factory';
import app, { init } from '@/app';

beforeAll(async () => {
  await init();
});

beforeEach(async () => {
  await cleanDb();
});

const server = supertest(app);

describe('GET /booking', () => {
  it('should respond with status 401 if no token is given', async () => {
    const response = await server.get('/booking');

    expect(response.statusCode).toBe(httpStatus.UNAUTHORIZED);
  });

  it('should respond with status 401 if given token is not valid', async () => {
    const token = faker.lorem.word();

    const response = await server.get('/booking').set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(httpStatus.UNAUTHORIZED);
  });

  it('should respond with status 401 if there is no session for given token', async () => {
    const userWithoutSession = await createUser();
    const token = jwt.sign({ userId: userWithoutSession.id }, process.env.JWT_SECRET);

    const response = await server.get('/booking').set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(httpStatus.UNAUTHORIZED);
  });

  describe('when token is valid', () => {
    it('should respond with status 404 when given ticket does not exist', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      await createEnrollmentWithAddress(user);

      const response = await server.get('/booking').set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toEqual(httpStatus.NOT_FOUND);
    });

    it('should respond with status 404 when given enrollment does not exist', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);

      const response = await server.get('/booking').set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toEqual(httpStatus.NOT_FOUND);
    });

    it('should respond with status 404 when user does not have a booking', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketTypeWithHotelIncluded();
      const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
      await createPayment(ticket.id, ticketType.price);
      const hotel = await createHotel();
      await createHotelRoom(hotel.id);

      const response = await server.get('/booking').set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toEqual(httpStatus.NOT_FOUND);
    });

    it('should respond with status 403 when ticketType not includes hotel', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketType();
      await createTicket(enrollment.id, ticketType.id, TicketStatus.RESERVED);
      const response = await server.get('/booking').set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toEqual(httpStatus.FORBIDDEN);
    });

    it('should respond with status 403 when ticket status is not paid', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketType();
      await createTicket(enrollment.id, ticketType.id, TicketStatus.RESERVED);
      const response = await server.get('/booking').set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toEqual(httpStatus.FORBIDDEN);
    });

    it('should respond with status 200 and with booking data', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketTypeWithHotelIncluded();

      await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

      const hotel = await createHotel();
      const hotelRoom = await createHotelRoom(hotel.id);

      const booking = await createBooking(user.id, hotelRoom.id);

      const response = await server.get('/booking').set('Authorization', `Bearer ${token}`);

      expect(response.status).toEqual(httpStatus.OK);
      expect(response.body).toEqual({
        id: booking.id,
        Room: {
          id: expect.any(Number),
          name: expect.any(String),
          capacity: expect.any(Number),
          hotelId: expect.any(Number),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });
    });
  });
});

describe('POST /booking', () => {
  it('should respond with status 401 if no token is given', async () => {
    const body = { roomId: 1 };

    const response = await server.post('/booking').send(body);

    expect(response.statusCode).toBe(httpStatus.UNAUTHORIZED);
  });

  it('should respond with status 401 if given token is not valid', async () => {
    const token = faker.lorem.word();
    const body = { roomId: 1 };

    const response = await server.post('/booking').set('Authorization', `Bearer ${token}`).send(body);

    expect(response.statusCode).toBe(httpStatus.UNAUTHORIZED);
  });

  it('should respond with status 401 if there is no session for given token', async () => {
    const userWithoutSession = await createUser();
    const token = jwt.sign({ userId: userWithoutSession.id }, process.env.JWT_SECRET);
    const body = { roomId: 1 };

    const response = await server.post('/booking').set('Authorization', `Bearer ${token}`).send(body);

    expect(response.statusCode).toBe(httpStatus.UNAUTHORIZED);
  });

  describe('when token is valid', () => {
    it('should respond with status 404 when given ticket does not exist', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      await createEnrollmentWithAddress(user);
      const body = { roomId: 1 };

      const response = await server.post('/booking').set('Authorization', `Bearer ${token}`).send(body);

      expect(response.statusCode).toEqual(httpStatus.NOT_FOUND);
    });

    it('should respond with status 404 when given enrollment does not exist', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const body = { roomId: 1 };

      const response = await server.post('/booking').set('Authorization', `Bearer ${token}`).send(body);

      expect(response.statusCode).toEqual(httpStatus.NOT_FOUND);
    });

    it('should respond with status 404 when room does not exist', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketTypeWithHotelIncluded();
      const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
      await createPayment(ticket.id, ticketType.price);

      const hotel = await createHotel();
      const hotelRoom = await createHotelRoom(hotel.id);
      const body = { roomId: hotelRoom.id + 100 };

      await createBooking(user.id, hotelRoom.id);

      const response = await server.post('/booking').set('Authorization', `Bearer ${token}`).send(body);

      expect(response.statusCode).toEqual(httpStatus.NOT_FOUND);
    });

    it('should respond with status 404 when user does not have a booking', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketTypeWithHotelIncluded();
      const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
      await createPayment(ticket.id, ticketType.price);
      const hotel = await createHotel();
      const createdRoom = await createHotelRoom(hotel.id);
      const body = { roomId: createdRoom.id };

      const response = await server.get('/booking').set('Authorization', `Bearer ${token}`).send(body);

      expect(response.statusCode).toEqual(httpStatus.NOT_FOUND);
    });

    it('should respond with status 403 when the hotel room is full', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketType();
      const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
      await createPayment(ticket.id, ticketType.price);

      const hotel = await createHotel();
      const createdRoom = await createFullRoom(hotel.id);
      const body = { roomId: createdRoom.id };

      const response = await server.post('/booking').set('Authorization', `Bearer ${token}`).send(body);
      expect(response.statusCode).toEqual(httpStatus.FORBIDDEN);
    });

    it('should respond with status 403 when ticketType not includes hotel', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketType();
      const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
      await createPayment(ticket.id, ticketType.price);

      const hotel = await createHotel();
      const hotelRoom = await createHotelRoom(hotel.id);
      const body = { roomId: hotelRoom.id };

      const response = await server.post('/booking').set('Authorization', `Bearer ${token}`).send(body);

      expect(response.statusCode).toEqual(httpStatus.FORBIDDEN);
    });

    it('should respond with status 403 when ticket status is not paid', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketTypeWithHotelIncluded();
      const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.RESERVED);
      await createPayment(ticket.id, ticketType.price);

      const hotel = await createHotel();
      const hotelRoom = await createHotelRoom(hotel.id);
      const body = { roomId: hotelRoom.id };

      const response = await server.post('/booking').set('Authorization', `Bearer ${token}`).send(body);

      expect(response.statusCode).toEqual(httpStatus.FORBIDDEN);
    });

    it('should respond with status 200 and with bookingId', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketTypeWithHotelIncluded();
      const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
      await createPayment(ticket.id, ticketType.price);

      const hotel = await createHotel();
      const hotelRoom = await createHotelRoom(hotel.id);
      const body = { roomId: hotelRoom.id };

      const response = await server.post('/booking').set('Authorization', `Bearer ${token}`).send(body);
      expect(response.statusCode).toEqual(httpStatus.OK);
      expect(response.body).toEqual({
        bookingId: expect.any(Number),
      });
    });
  });
});

describe('PUT /booking/:bookingId', () => {
  it('should respond with status 401 if no token is given', async () => {
    const response = await server.put('/booking/1');

    expect(response.statusCode).toBe(httpStatus.UNAUTHORIZED);
  });

  it('should respond with status 401 if given token is not valid', async () => {
    const token = faker.lorem.word();

    const response = await server.put('/booking/1').set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(httpStatus.UNAUTHORIZED);
  });

  it('should respond with status 401 if there is no session for given token', async () => {
    const userWithoutSession = await createUser();
    const token = jwt.sign({ userId: userWithoutSession.id }, process.env.JWT_SECRET);

    const response = await server.put('/booking/1').set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(httpStatus.UNAUTHORIZED);
  });

  describe('when token is valid', () => {
    it('should respond with status 404 when room does not exist', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketTypeWithHotelIncluded();
      const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
      await createPayment(ticket.id, ticketType.price);

      const hotel = await createHotel();
      const hotelRoom = await createHotelRoom(hotel.id);
      const body = { roomId: hotelRoom.id + 100 };

      await createBooking(user.id, hotelRoom.id);

      const response = await server.put('/booking/1').set('Authorization', `Bearer ${token}`).send(body);

      expect(response.statusCode).toEqual(httpStatus.NOT_FOUND);
    });

    it('should respond with status 403 when room does not have vacancy', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketTypeWithHotelIncluded();
      const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
      await createPayment(ticket.id, ticketType.price);

      const hotel = await createHotel();
      const hotelRoom = await createFullRoom(hotel.id);
      const body = { roomId: hotelRoom.id };

      const booking = await createBooking(user.id, hotelRoom.id);

      const response = await server.put(`/booking/${booking.id}`).set('Authorization', `Bearer ${token}`).send(body);

      expect(response.statusCode).toEqual(httpStatus.FORBIDDEN);
    });

    it('should respond with status 403 when user does not have any bookings', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketTypeWithHotelIncluded();
      const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
      await createPayment(ticket.id, ticketType.price);

      const hotel = await createHotel();
      const hotelRoom = await createHotelRoom(hotel.id);
      const body = { roomId: hotelRoom.id };

      const response = await server.put('/booking/999').set('Authorization', `Bearer ${token}`).send(body);

      expect(response.statusCode).toEqual(httpStatus.FORBIDDEN);
    });

    it('should respond with status 400 when bookingId is invalid', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketTypeWithHotelIncluded();
      const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
      await createPayment(ticket.id, ticketType.price);

      const hotel = await createHotel();
      const hotelRoom = await createHotelRoom(hotel.id);
      const body = { roomId: hotelRoom.id };

      const response = await server.put(`/booking/abc`).set('Authorization', `Bearer ${token}`).send(body);
      expect(response.statusCode).toEqual(httpStatus.BAD_REQUEST);
    });

    it('should respond with status 200 with roomId', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketTypeWithHotelIncluded();
      const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
      await createPayment(ticket.id, ticketType.price);

      const hotel = await createHotel();
      const hotelRoom = await createHotelRoom(hotel.id);
      const otherRoom = await createHotelRoom(hotel.id);

      const booking = await createBooking(user.id, hotelRoom.id);

      const body = { roomId: otherRoom.id };

      const response = await server.put(`/booking/${booking.id}`).set('Authorization', `Bearer ${token}`).send(body);

      expect(response.statusCode).toEqual(httpStatus.OK);
      expect(response.body).toEqual({
        bookingId: expect.any(Number),
      });
    });
  });
});
