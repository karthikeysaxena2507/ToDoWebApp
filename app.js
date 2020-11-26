require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb+srv://admin-karthikey:Test123@cluster0.iinei.mongodb.net/ToDoDB?retryWrites=true&w=majority", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify:false
});

mongoose.set("useCreateIndex", true);

const itemSchema = new mongoose.Schema({
    content: String 
});

const Item = new mongoose.model("Item", itemSchema);

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    googleId: String,
    items: [itemSchema]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/todo",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {

    User.findOrCreate( { 
        googleId: profile.id,
        username: profile._json.given_name
    }, function(err, user) {
        return cb(err, user);
    });
  }
));

let defaultItem = new Item({
    content: "Add items to the list by clicking on + and delete by clicking on corresponding checkbox"
  });

app.get("/", function(req, res) {
    res.render("home");
});

app.get("/auth/google", passport.authenticate("google", { 
    scope: ["profile"]
 })
);

app.get("/auth/google/todo", passport.authenticate("google", {
    failureRedirect: "/login"
    }), function(req, res) {
        res.redirect("/"+req.user.username);
});

app.get("/login/:message", function(req, res) {
    res.render("login", {
        message: req.params.message
    });
});

app.get("/register/:message", function(req, res) {
    res.render("register", {
        message: req.params.message
    });
});

app.get("/:username", function(req, res) {
    User.findOne({
        username: req.params.username
    }, function(err, foundUser) {
        if(err) {
            console.log(err);
        }
        else {
            if(foundUser !== null) {
                if(req.isAuthenticated()) {
                    if(foundUser.items.length === 0) {
                        foundUser.items.push(defaultItem);
                        foundUser.save();
                    }
                    res.render("post", {
                        username: req.params.username,
                        userItems: foundUser.items
                    });
                }
                else {
                    res.redirect("/login" + "/" + " ");
                }
            }
        }
    });
});

app.post("/logout", function(req, res) {
    req.logOut();
    res.redirect("/");
});

app.post("/", function(req, res) {
    res.redirect("/" + req.body.btn + "/" + " ");
});

app.post("/login", function(req, res) {
    const user = new User ({
        username: req.body.username,
        password: req.body.password
    });
    req.login(user, function(err) {
        if(err) {
            console.log(err);
        }
        else {
            passport.authenticate("local")(req, res, function() {
                res.redirect("/" + req.body.username);
            });
        }
    });
});

app.post("/register", function(req, res) {
    User.findOne({
        username: req.body.username
    }, function(err, foundUser) {
        if(err) {
            console.log(err);
        }
        else 
        {
            if(foundUser === null) {
                if(req.body.password === req.body.password1) {
                    User.register({username: req.body.username}, req.body.password, function(err, user) {
                        if(err) {
                            console.log(err);
                            res.redirect("/register" + " ");
                        }
                        else {
                            passport.authenticate("local")(req, res, function(){
                                res.redirect("/" + req.body.username);
                            });
                        }
                    });
                }
                else {
                    res.redirect("/register" + "/" + "passwords don't match");    
                }
            }
                
            else {
                res.redirect("/register" + "/" + "username already exists");
            }
        }
    });
});

app.post("/insert", function(req, res) {

    const item = new Item ({
        content: req.body.newItem
    });
    User.findOne({
        username: req.body.user
    }, function(err, foundUser) {
        if(err) {
            console.log(err);
        }
        else {
            if(foundUser !== null) {
                foundUser.items.push(item);
                foundUser.save();
                res.redirect("/"+req.body.user);
            }
        }
    });
});

app.post("/delete", function(req, res) {
    User.findOneAndUpdate({
        username: req.body.username
    }, {
        $pull: {
            items: {
                _id: req.body.checkbox
            }
        }
    }, function(err, foundUser) {
        if (!err) {
            res.redirect("/" + foundUser.username);
          }
    });
});

let port = process.env.PORT || 3000;

app.listen(port, function() {
    console.log("server is ready");
});